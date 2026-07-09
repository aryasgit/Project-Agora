"""Simulation runner — wires traders into the engine and steps the market.

Each step: every trader observes the current market and (maybe) submits orders;
the engine matches them; analytics captures a snapshot. Over many steps a
coherent price series emerges from the agents' interaction.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Optional

from .analytics import Analytics
from .engine import MatchingEngine
from .instrument import Instrument
from .orders import Side
from .traders import (
    AggressiveBuyer,
    MarketMaker,
    MeanReversionTrader,
    MomentumTrader,
    PassiveSeller,
    RandomTrader,
    Trader,
)


@dataclass
class Simulation:
    instrument: Instrument
    traders: list[Trader]
    seed: int = 42
    engine: MatchingEngine = field(init=False)
    analytics: Analytics = field(init=False)
    rng: random.Random = field(init=False)
    step_count: int = field(default=0, init=False)

    def __post_init__(self):
        self.engine = MatchingEngine(self.instrument)
        self.analytics = Analytics(self.engine)
        self.rng = random.Random(self.seed)
        # market makers need fill callbacks to track inventory
        self._mms = [t for t in self.traders if isinstance(t, MarketMaker)]
        if self._mms:
            self.engine.add_trade_listener(self._route_fill)

    def _route_fill(self, trade):
        for mm in self._mms:
            if trade.maker_trader_id == mm.id:
                # maker sold if aggressor bought, and vice-versa
                mm.on_fill(trade.aggressor_side.opposite, trade.quantity)
            if trade.taker_trader_id == mm.id:
                mm.on_fill(trade.aggressor_side, trade.quantity)

    def step(self) -> None:
        self.step_count += 1
        # Collect every order generated this step, then submit them in ARRIVAL
        # order: arrival = the trader's latency + a little jitter. Faster agents
        # (market makers) reach the book first and win the front of the queue —
        # this is what makes queue position, and the race for it, meaningful.
        pending = []
        for trader in self.traders:
            for order in trader.act(self.engine, self.rng):
                jitter = self.rng.random()
                pending.append((order.latency + jitter, order))
        pending.sort(key=lambda p: p[0])
        for _, order in pending:
            self.engine.submit(order)
        self.analytics.capture(self.step_count)

    def run(self, steps: int) -> Analytics:
        for _ in range(steps):
            self.step()
        return self.analytics


def default_market(seed: int = 42) -> Simulation:
    """A balanced default cast that produces an interesting, stable-ish market."""
    inst = Instrument("AGORA")
    traders = [
        MarketMaker("MM-1", half_spread=3, quote_size=12),
        MarketMaker("MM-2", half_spread=4, quote_size=8),
        RandomTrader("NOISE-1"),
        RandomTrader("NOISE-2"),
        RandomTrader("NOISE-3"),
        MomentumTrader("MOMENTUM-1"),
        MeanReversionTrader("MEANREV-1"),
        AggressiveBuyer("INST-1", qty=8, activity=0.15),
        PassiveSeller("PASSIVE-1"),
    ]
    return Simulation(inst, traders, seed=seed)


def _seed_book(sim: Simulation, mid: int = 5000) -> None:
    """Prime the book so early steps have something to trade against."""
    from .orders import Order, OrderType, TimeInForce
    e = sim.engine
    for i in range(1, 6):
        e.submit(Order(id=e.next_id(), side=Side.BUY, type=OrderType.LIMIT,
                       quantity=10, price=mid - i, trader_id="SEED"))
        e.submit(Order(id=e.next_id(), side=Side.SELL, type=OrderType.LIMIT,
                       quantity=10, price=mid + i, trader_id="SEED"))
    e.last_price = mid


if __name__ == "__main__":
    sim = default_market()
    _seed_book(sim)
    analytics = sim.run(500)
    import json
    print(json.dumps(analytics.summary(), indent=2, default=str))
