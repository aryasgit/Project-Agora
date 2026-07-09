"""Orders and Trades — the atoms of the market.

An Order is an instruction; a Trade is what happens when two orders match.
Prices here are already in INTEGER TICKS (the engine's internal unit). Market
orders carry price=None (they take whatever the book offers).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Side(Enum):
    BUY = "BUY"
    SELL = "SELL"

    @property
    def opposite(self) -> "Side":
        return Side.SELL if self is Side.BUY else Side.BUY


class OrderType(Enum):
    MARKET = "MARKET"        # take liquidity now, at any price
    LIMIT = "LIMIT"          # rest/execute only at a price or better
    STOP = "STOP"            # becomes a MARKET order once trigger is hit
    STOP_LIMIT = "STOP_LIMIT"  # becomes a LIMIT order once trigger is hit


class TimeInForce(Enum):
    GTC = "GTC"   # Good-Till-Cancelled: rests until filled or cancelled
    IOC = "IOC"   # Immediate-Or-Cancel: fill what you can now, cancel the rest
    FOK = "FOK"   # Fill-Or-Kill: fill entirely at once or cancel completely


@dataclass(slots=True)
class Order:
    id: int
    side: Side
    type: OrderType
    quantity: int                 # remaining quantity to fill (in units/lots)
    price: int | None = None      # limit price in TICKS; None for MARKET/STOP
    stop_price: int | None = None  # trigger price in TICKS (STOP/STOP_LIMIT)
    tif: TimeInForce = TimeInForce.GTC
    trader_id: str | None = None
    seq: int = 0                  # arrival sequence — the "time" in price-time priority
    latency: int = 0              # arrival delay; lower latency → earlier arrival → better queue spot
    original_quantity: int = 0

    def __post_init__(self) -> None:
        if self.original_quantity == 0:
            self.original_quantity = self.quantity

    @property
    def is_filled(self) -> bool:
        return self.quantity == 0

    @property
    def filled_quantity(self) -> int:
        return self.original_quantity - self.quantity


@dataclass(frozen=True, slots=True)
class Trade:
    price: int            # execution price in TICKS
    quantity: int
    aggressor_side: Side  # side of the incoming (taking) order
    maker_order_id: int   # the resting order that was hit
    taker_order_id: int   # the incoming order that crossed
    seq: int              # global trade sequence number
    maker_trader_id: str | None = None
    taker_trader_id: str | None = None
