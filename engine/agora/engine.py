"""The matching engine — price-time priority.

Rules enforced:
  * PRICE priority: better-priced resting orders fill first (higher bids,
    lower asks).
  * TIME priority: at equal price, earlier arrivals (lower seq) fill first —
    this is the FIFO queue inside each PriceLevel.

Supports: MARKET, LIMIT, STOP, STOP_LIMIT order types; GTC / IOC / FOK
time-in-force; full & partial fills; cancel; modify (cancel-replace, which
correctly LOSES time priority — a real exchange behaviour).
"""
from __future__ import annotations

from typing import Callable, Optional

from .book import OrderBook
from .instrument import Instrument
from .orders import Order, OrderType, Side, TimeInForce, Trade


class MatchingEngine:
    def __init__(self, instrument: Instrument):
        self.instrument = instrument
        self.book = OrderBook()
        self._order_seq = 0
        self._trade_seq = 0
        self._id_seq = 0
        self.last_price: Optional[int] = None
        self.trades: list[Trade] = []
        self._resting_stops: list[Order] = []
        # observers get called with each Trade (used by analytics / web layer)
        self._trade_listeners: list[Callable[[Trade], None]] = []

    # --- public API ------------------------------------------------------
    def next_id(self) -> int:
        self._id_seq += 1
        return self._id_seq

    def add_trade_listener(self, fn: Callable[[Trade], None]) -> None:
        self._trade_listeners.append(fn)

    def submit(self, order: Order) -> list[Trade]:
        """Submit an order; returns the trades it generated (possibly empty)."""
        self._order_seq += 1
        order.seq = self._order_seq
        if order.original_quantity == 0:
            order.original_quantity = order.quantity

        if order.type in (OrderType.STOP, OrderType.STOP_LIMIT):
            if not self._stop_triggered(order):
                self._resting_stops.append(order)
                return []
            self._convert_stop(order)

        trades = self._match(order)
        self._check_stops()
        return trades

    def cancel(self, order_id: int) -> bool:
        removed = self.book.remove(order_id)
        if removed is not None:
            return True
        # maybe it's a resting (untriggered) stop
        for i, o in enumerate(self._resting_stops):
            if o.id == order_id:
                del self._resting_stops[i]
                return True
        return False

    def modify(self, order_id: int, new_quantity: int, new_price: int | None) -> Optional[Order]:
        """Cancel-replace. Increasing qty or changing price forfeits time
        priority (the modified order goes to the back of its new queue) — this
        matches real exchange semantics and is why 'modify' is not free.
        """
        existing = self.book.remove(order_id)
        if existing is None:
            return None
        replacement = Order(
            id=self.next_id(),
            side=existing.side,
            type=existing.type,
            quantity=new_quantity,
            price=new_price if new_price is not None else existing.price,
            tif=existing.tif,
            trader_id=existing.trader_id,
        )
        self.submit(replacement)
        return replacement

    # --- matching core ---------------------------------------------------
    def _match(self, order: Order) -> list[Trade]:
        trades: list[Trade] = []
        is_market = order.type == OrderType.MARKET or order.price is None

        # FOK: verify full fill is available before touching the book.
        if order.tif == TimeInForce.FOK and not self._can_fully_fill(order):
            return []

        while order.quantity > 0:
            opp_level = (
                self.book.best_ask_level() if order.side is Side.BUY
                else self.book.best_bid_level()
            )
            if opp_level is None:
                break  # no liquidity left
            if not is_market and not self._price_crosses(order, opp_level.price):
                break  # best opposite price no longer acceptable for a limit

            maker = opp_level.peek()
            fill_qty = min(order.quantity, maker.quantity)
            trade = self._execute(order, maker, opp_level.price, fill_qty)
            trades.append(trade)

            order.quantity -= fill_qty
            maker.quantity -= fill_qty
            opp_level.reduce_front(fill_qty)
            if maker.is_filled:
                opp_level.popleft()
                self.book._drop_index(maker.id)
                if not opp_level:
                    self.book._prune_if_empty(maker.side, opp_level.price)

        # Handle any unfilled remainder.
        if order.quantity > 0 and not is_market and order.tif == TimeInForce.GTC:
            self.book.add(order)  # rest as passive liquidity
        # MARKET remainder is discarded; IOC/FOK remainder is cancelled implicitly.
        return trades

    def _execute(self, taker: Order, maker: Order, price: int, qty: int) -> Trade:
        self._trade_seq += 1
        self.last_price = price
        trade = Trade(
            price=price,
            quantity=qty,
            aggressor_side=taker.side,
            maker_order_id=maker.id,
            taker_order_id=taker.id,
            seq=self._trade_seq,
            maker_trader_id=maker.trader_id,
            taker_trader_id=taker.trader_id,
        )
        self.trades.append(trade)
        for fn in self._trade_listeners:
            fn(trade)
        return trade

    def _price_crosses(self, order: Order, resting_price: int) -> bool:
        if order.side is Side.BUY:
            return order.price >= resting_price
        return order.price <= resting_price

    def _can_fully_fill(self, order: Order) -> bool:
        """Walk the opposite side (read-only) to see if `order.quantity` can be
        fully matched — needed for FOK."""
        need = order.quantity
        is_market = order.type == OrderType.MARKET or order.price is None
        side_book = self.book._asks if order.side is Side.BUY else self.book._bids
        for key in side_book:
            level = side_book[key]
            if not is_market and not self._price_crosses(order, level.price):
                break
            need -= level.volume
            if need <= 0:
                return True
        return need <= 0

    # --- stop-order handling --------------------------------------------
    def _stop_triggered(self, order: Order) -> bool:
        if self.last_price is None or order.stop_price is None:
            return False
        # Buy stop triggers when price rises to/above stop; sell stop when it
        # falls to/below stop.
        if order.side is Side.BUY:
            return self.last_price >= order.stop_price
        return self.last_price <= order.stop_price

    def _convert_stop(self, order: Order) -> None:
        if order.type == OrderType.STOP:
            order.type = OrderType.MARKET
            order.price = None
        else:  # STOP_LIMIT -> LIMIT at its price
            order.type = OrderType.LIMIT

    def _check_stops(self) -> None:
        """After each trade, triggered stops become active and are matched.
        Cascades: a triggered stop can move the price and trip more stops."""
        triggered = [o for o in self._resting_stops if self._stop_triggered(o)]
        if not triggered:
            return
        for o in triggered:
            self._resting_stops.remove(o)
        for o in triggered:
            self._convert_stop(o)
            self._match(o)
        self._check_stops()  # cascade

    # --- convenience -----------------------------------------------------
    def market_price(self) -> Optional[int]:
        """Best available reference price: last trade, else book mid."""
        if self.last_price is not None:
            return self.last_price
        mid = self.book.mid()
        return int(mid) if mid is not None else None
