"""Analytics layer — the metrics that make market behaviour legible.

Everything here is derived from two streams the engine already produces: the
trade tape and book snapshots. Prices are in integer TICKS unless a metric is
explicitly a ratio.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from statistics import fmean, pstdev
from typing import Optional

from .engine import MatchingEngine
from .orders import Side, Trade


@dataclass
class Snapshot:
    """One point-in-time record of market state, taken each simulation step."""
    step: int
    last_price: Optional[int]
    best_bid: Optional[int]
    best_ask: Optional[int]
    spread: Optional[int]
    mid: Optional[float]
    bid_volume: int
    ask_volume: int
    trade_count: int


class Analytics:
    """Accumulates snapshots + trade tape and computes summary metrics."""

    def __init__(self, eng: MatchingEngine, depth_levels: int = 10):
        self.eng = eng
        self.depth_levels = depth_levels
        self.snapshots: list[Snapshot] = []

    # --- capture ---------------------------------------------------------
    def capture(self, step: int) -> Snapshot:
        book = self.eng.book
        depth = book.depth(self.depth_levels)
        snap = Snapshot(
            step=step,
            last_price=self.eng.last_price,
            best_bid=book.best_bid(),
            best_ask=book.best_ask(),
            spread=book.spread(),
            mid=book.mid(),
            bid_volume=sum(v for _, v in depth["bids"]),
            ask_volume=sum(v for _, v in depth["asks"]),
            trade_count=len(self.eng.trades),
        )
        self.snapshots.append(snap)
        return snap

    # --- trade-tape metrics ---------------------------------------------
    def vwap(self, window: Optional[int] = None) -> Optional[float]:
        """Volume-Weighted Average Price — the average execution price, weighted
        by size. The benchmark institutions measure their fills against."""
        trades = self.eng.trades[-window:] if window else self.eng.trades
        vol = sum(t.quantity for t in trades)
        if vol == 0:
            return None
        return sum(t.price * t.quantity for t in trades) / vol

    def total_volume(self) -> int:
        return sum(t.quantity for t in self.eng.trades)

    def trade_frequency(self) -> float:
        """Trades per snapshot step — a proxy for market activity."""
        if not self.snapshots:
            return 0.0
        return len(self.eng.trades) / len(self.snapshots)

    # --- spread / liquidity ---------------------------------------------
    def average_spread(self) -> Optional[float]:
        spreads = [s.spread for s in self.snapshots if s.spread is not None]
        return fmean(spreads) if spreads else None

    def order_imbalance(self) -> Optional[float]:
        """(bid_vol - ask_vol) / (bid_vol + ask_vol) at the top of book.
        Positive -> buy-side pressure (price likely to rise), negative -> sell
        pressure. One of the most predictive microstructure signals."""
        book = self.eng.book
        bb, ba = book.best_bid_level(), book.best_ask_level()
        if bb is None or ba is None:
            return None
        total = bb.volume + ba.volume
        if total == 0:
            return None
        return (bb.volume - ba.volume) / total

    def market_depth(self, levels: int = 10):
        return self.eng.book.depth(levels)

    # --- risk / volatility ----------------------------------------------
    def realized_volatility(self) -> Optional[float]:
        """Std-dev of log returns of the mid-price series. The core measure of
        how much the price is moving (risk)."""
        mids = [s.mid for s in self.snapshots if s.mid]
        if len(mids) < 3:
            return None
        rets = [math.log(mids[i] / mids[i - 1]) for i in range(1, len(mids))
                if mids[i - 1] > 0]
        return pstdev(rets) if len(rets) >= 2 else None

    # --- one-shot summary for the UI ------------------------------------
    def summary(self) -> dict:
        return {
            "last_price": self.eng.last_price,
            "vwap": self.vwap(),
            "total_volume": self.total_volume(),
            "trade_count": len(self.eng.trades),
            "average_spread": self.average_spread(),
            "current_spread": self.eng.book.spread(),
            "order_imbalance": self.order_imbalance(),
            "realized_volatility": self.realized_volatility(),
            "trade_frequency": self.trade_frequency(),
        }
