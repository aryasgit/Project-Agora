"""Simulated traders — the agents whose interaction *creates* the price.

Each trader implements `act(engine, rng) -> list[Order]`. The simulation loop
calls them in turn; nobody sets the price, it emerges from their collective
order flow (see vault: Market-Participants, Price-Discovery).

Prices passed around here are in integer TICKS (engine units).
"""
from __future__ import annotations

import random
from typing import Optional

from .engine import MatchingEngine
from .orders import Order, OrderType, Side, TimeInForce


class Trader:
    # Base arrival latency (lower = faster tech = better queue position). Fast
    # market makers colocate; noise/retail flow is slow. This is what makes the
    # race for the front of the queue meaningful.
    latency: int = 100

    def __init__(self, trader_id: str):
        self.id = trader_id

    def act(self, eng: MatchingEngine, rng: random.Random) -> list[Order]:
        return []

    # helper for subclasses
    def _order(self, eng, side, otype, qty, price=None, tif=TimeInForce.GTC, stop=None):
        return Order(id=eng.next_id(), side=side, type=otype, quantity=qty,
                     price=price, stop_price=stop, tif=tif, trader_id=self.id,
                     latency=self.latency)


class RandomTrader(Trader):
    """Uninformed 'noise' flow: randomly buys or sells near the touch. This is
    the baseline that keeps the market ticking."""

    latency = 90  # retail-ish: relatively slow

    def __init__(self, trader_id, max_qty=5, activity=0.7):
        super().__init__(trader_id)
        self.max_qty = max_qty
        self.activity = activity

    def act(self, eng, rng):
        if rng.random() > self.activity:
            return []
        ref = eng.market_price()
        if ref is None:
            ref = 5000
        side = rng.choice([Side.BUY, Side.SELL])
        qty = rng.randint(1, self.max_qty)
        if rng.random() < 0.4:  # sometimes cross the spread (take liquidity)
            return [self._order(eng, side, OrderType.MARKET, qty)]
        offset = rng.randint(1, 5)
        price = ref - offset if side is Side.BUY else ref + offset
        return [self._order(eng, side, OrderType.LIMIT, qty, price=price)]


class MarketMaker(Trader):
    """Liquidity provider: continuously quotes both sides around a reference,
    skewing quotes as inventory builds (inventory risk management)."""

    latency = 10  # colocated / fastest — wins the race to the front of the queue

    def __init__(self, trader_id, half_spread=3, quote_size=10, max_inventory=50):
        super().__init__(trader_id)
        self.half_spread = half_spread
        self.quote_size = quote_size
        self.max_inventory = max_inventory
        self.inventory = 0
        self._live: list[int] = []

    def on_fill(self, side: Side, qty: int) -> None:
        self.inventory += qty if side is Side.BUY else -qty

    def act(self, eng, rng):
        # pull previous quotes (cancel-replace each step)
        for oid in self._live:
            eng.cancel(oid)
        self._live.clear()

        ref = eng.market_price() or 5000
        # skew: if long, lower quotes to sell more / buy less, and vice-versa
        skew = int(self.inventory / max(self.max_inventory, 1) * self.half_spread)
        bid = ref - self.half_spread - skew
        ask = ref + self.half_spread - skew
        orders = []
        if self.inventory < self.max_inventory:
            b = self._order(eng, Side.BUY, OrderType.LIMIT, self.quote_size, price=bid)
            orders.append(b)
            self._live.append(b.id)
        if self.inventory > -self.max_inventory:
            a = self._order(eng, Side.SELL, OrderType.LIMIT, self.quote_size, price=ask)
            orders.append(a)
            self._live.append(a.id)
        return orders


class MomentumTrader(Trader):
    """Trend-follower: buys when price has been rising, sells when falling.
    Amplifies moves — the seed of volatility and, in extremis, flash crashes."""

    latency = 30

    def __init__(self, trader_id, lookback=10, qty=4, threshold=2):
        super().__init__(trader_id)
        self.lookback = lookback
        self.qty = qty
        self.threshold = threshold

    def act(self, eng, rng):
        prices = [t.price for t in eng.trades[-self.lookback:]]
        if len(prices) < self.lookback:
            return []
        change = prices[-1] - prices[0]
        if change > self.threshold:
            return [self._order(eng, Side.BUY, OrderType.MARKET, self.qty)]
        if change < -self.threshold:
            return [self._order(eng, Side.SELL, OrderType.MARKET, self.qty)]
        return []


class MeanReversionTrader(Trader):
    """Fades extremes: sells when price runs above its recent average, buys
    when it dips below. A stabilising force that opposes momentum."""

    latency = 40

    def __init__(self, trader_id, lookback=20, qty=4, band=3):
        super().__init__(trader_id)
        self.lookback = lookback
        self.qty = qty
        self.band = band

    def act(self, eng, rng):
        prices = [t.price for t in eng.trades[-self.lookback:]]
        if len(prices) < self.lookback:
            return []
        avg = sum(prices) / len(prices)
        last = prices[-1]
        if last > avg + self.band:
            return [self._order(eng, Side.SELL, OrderType.MARKET, self.qty)]
        if last < avg - self.band:
            return [self._order(eng, Side.BUY, OrderType.MARKET, self.qty)]
        return []


class AggressiveBuyer(Trader):
    """A large directional buyer (think an institution accumulating). Sends
    market buys; demonstrates market impact when unsliced."""

    latency = 20  # well-resourced desk

    def __init__(self, trader_id, qty=8, activity=0.3):
        super().__init__(trader_id)
        self.qty = qty
        self.activity = activity

    def act(self, eng, rng):
        if rng.random() > self.activity:
            return []
        return [self._order(eng, Side.BUY, OrderType.MARKET, self.qty)]


class PassiveSeller(Trader):
    """Rests offers above the market and waits — pure liquidity provision on
    one side."""

    latency = 120  # patient, slow

    def __init__(self, trader_id, qty=6, offset=6, activity=0.4):
        super().__init__(trader_id)
        self.qty = qty
        self.offset = offset
        self.activity = activity

    def act(self, eng, rng):
        if rng.random() > self.activity:
            return []
        ref = eng.market_price() or 5000
        return [self._order(eng, Side.SELL, OrderType.LIMIT, self.qty,
                            price=ref + self.offset)]
