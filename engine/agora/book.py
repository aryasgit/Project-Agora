"""The limit order book.

A book is two sorted collections of PRICE LEVELS — bids (buy interest) and
asks (sell interest). Each price level holds a FIFO queue of resting orders,
which encodes the "time" half of price-time priority: earlier arrivals sit at
the front and fill first.

Data-structure choice (vault Milestone 4): a SortedDict keyed by integer tick
price gives O(log n) insert/remove of a level and O(1) access to the best
level (min key for asks, max key for bids). Within a level, a deque gives
O(1) append (new resting order) and O(1) popleft (fill the front of the queue).
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Iterable, Iterator, Optional

from sortedcontainers import SortedDict

from .orders import Order, Side


@dataclass(frozen=True, slots=True)
class QueuePosition:
    """Where a resting order stands in the FIFO queue at its price level.

    This is the quantity market makers obsess over: your fill probability is
    governed by how much volume sits *ahead* of you, because price-time
    priority fills the front of the queue first. Lower latency → earlier
    arrival → fewer lots ahead → you trade sooner and suffer less adverse
    selection.
    """
    price: int
    rank: int            # 1-based position in the queue (1 = front, next to fill)
    total_orders: int    # total resting orders at this price level
    orders_ahead: int
    volume_ahead: int    # lots that must fill before you
    orders_behind: int
    volume_behind: int
    own_remaining: int   # your own remaining quantity


class PriceLevel:
    """FIFO queue of resting orders at a single price."""

    __slots__ = ("price", "orders", "_volume")

    def __init__(self, price: int):
        self.price = price
        self.orders: deque[Order] = deque()
        self._volume = 0

    def append(self, order: Order) -> None:
        self.orders.append(order)
        self._volume += order.quantity

    def peek(self) -> Order:
        return self.orders[0]

    def popleft(self) -> Order:
        order = self.orders.popleft()
        self._volume -= order.quantity
        return order

    def reduce_front(self, filled: int) -> None:
        """Record a partial fill against the front order's volume accounting."""
        self._volume -= filled

    def remove(self, order: Order) -> bool:
        try:
            self.orders.remove(order)
        except ValueError:
            return False
        self._volume -= order.quantity
        return True

    @property
    def volume(self) -> int:
        return self._volume

    def __len__(self) -> int:
        return len(self.orders)

    def __bool__(self) -> bool:
        return bool(self.orders)


class OrderBook:
    def __init__(self) -> None:
        # bids: we want the HIGHEST price first -> negate keys so min-key = best bid.
        self._bids: SortedDict[int, PriceLevel] = SortedDict()
        # asks: LOWEST price first -> natural ordering, min-key = best ask.
        self._asks: SortedDict[int, PriceLevel] = SortedDict()
        self._index: dict[int, tuple[Side, int]] = {}  # order_id -> (side, price)

    # --- side helpers ----------------------------------------------------
    def _side_map(self, side: Side) -> SortedDict:
        return self._bids if side is Side.BUY else self._asks

    def _key(self, side: Side, price: int) -> int:
        # bids stored under negated key so ascending SortedDict puts best bid first
        return -price if side is Side.BUY else price

    # --- mutation --------------------------------------------------------
    def add(self, order: Order) -> None:
        assert order.price is not None, "resting order must have a limit price"
        book = self._side_map(order.side)
        key = self._key(order.side, order.price)
        level = book.get(key)
        if level is None:
            level = PriceLevel(order.price)
            book[key] = level
        level.append(order)
        self._index[order.id] = (order.side, order.price)

    def remove(self, order_id: int) -> Optional[Order]:
        loc = self._index.get(order_id)
        if loc is None:
            return None
        side, price = loc
        book = self._side_map(side)
        key = self._key(side, price)
        level = book.get(key)
        if level is None:
            return None
        target = next((o for o in level.orders if o.id == order_id), None)
        if target is None:
            return None
        level.remove(target)
        if not level:
            del book[key]
        del self._index[order_id]
        return target

    def contains(self, order_id: int) -> bool:
        return order_id in self._index

    def queue_position(self, order_id: int) -> Optional[QueuePosition]:
        """Return where a resting order stands in its price-level FIFO queue.

        O(k) in the number of orders at that one price level. Returns None if
        the order isn't resting (never placed, already filled, or cancelled).
        """
        loc = self._index.get(order_id)
        if loc is None:
            return None
        side, price = loc
        level = self._side_map(side).get(self._key(side, price))
        if level is None:
            return None
        orders_ahead = 0
        volume_ahead = 0
        own: Optional[Order] = None
        for o in level.orders:
            if o.id == order_id:
                own = o
                break
            orders_ahead += 1
            volume_ahead += o.quantity
        if own is None:
            return None
        rank = orders_ahead + 1
        behind = list(level.orders)[rank:]
        return QueuePosition(
            price=price,
            rank=rank,
            total_orders=len(level.orders),
            orders_ahead=orders_ahead,
            volume_ahead=volume_ahead,
            orders_behind=len(behind),
            volume_behind=sum(o.quantity for o in behind),
            own_remaining=own.quantity,
        )

    # --- best-of-book ----------------------------------------------------
    def best_bid(self) -> Optional[int]:
        if not self._bids:
            return None
        return -next(iter(self._bids))  # undo negation

    def best_ask(self) -> Optional[int]:
        if not self._asks:
            return None
        return next(iter(self._asks))

    def best_bid_level(self) -> Optional[PriceLevel]:
        if not self._bids:
            return None
        return self._bids[next(iter(self._bids))]

    def best_ask_level(self) -> Optional[PriceLevel]:
        if not self._asks:
            return None
        return self._asks[next(iter(self._asks))]

    def spread(self) -> Optional[int]:
        b, a = self.best_bid(), self.best_ask()
        if b is None or a is None:
            return None
        return a - b

    def mid(self) -> Optional[float]:
        b, a = self.best_bid(), self.best_ask()
        if b is None or a is None:
            return None
        return (a + b) / 2

    # --- depth / introspection ------------------------------------------
    def depth(self, levels: int = 10) -> dict[str, list[tuple[int, int]]]:
        """Return up to `levels` (price, volume) tuples per side, best-first."""
        bids = [(lvl.price, lvl.volume) for lvl in self._iter_levels(self._bids, levels)]
        asks = [(lvl.price, lvl.volume) for lvl in self._iter_levels(self._asks, levels)]
        return {"bids": bids, "asks": asks}

    @staticmethod
    def _iter_levels(book: SortedDict, limit: int) -> Iterator[PriceLevel]:
        for i, key in enumerate(book):
            if i >= limit:
                break
            yield book[key]

    def all_orders(self, side: Side) -> Iterable[Order]:
        for key in self._side_map(side):
            yield from self._side_map(side)[key].orders

    def _prune_if_empty(self, side: Side, price: int) -> None:
        book = self._side_map(side)
        key = self._key(side, price)
        level = book.get(key)
        if level is not None and not level:
            del book[key]

    def _drop_index(self, order_id: int) -> None:
        self._index.pop(order_id, None)
