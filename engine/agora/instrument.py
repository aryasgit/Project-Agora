"""Instrument — the tradeable object.

The core engine needs almost nothing about an instrument: a symbol, a price
grid (tick size) and a quantity grid (lot size). Everything else (expiry,
strike, multiplier) is derivative-only metadata and is deliberately absent —
the matching engine is instrument-agnostic (see vault: Financial-Instruments).

Design decision (vault ADR-0002): prices and quantities are handled as
INTEGERS internally. A price is stored as an integer number of ticks
(e.g. tick_size=0.01, price $50.01 -> 5001 ticks). This makes price-level
equality exact and matching deterministic; floats must never key the book.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


@dataclass(frozen=True, slots=True)
class Instrument:
    symbol: str
    tick_size: Decimal = Decimal("0.01")
    lot_size: int = 1

    def __post_init__(self) -> None:
        if self.tick_size <= 0:
            raise ValueError("tick_size must be positive")
        if self.lot_size <= 0:
            raise ValueError("lot_size must be positive")

    # --- price <-> ticks -------------------------------------------------
    def to_ticks(self, price: Decimal | str | int | float) -> int:
        """Convert a human price to integer ticks. Rejects off-grid prices.

        50.005 on a 0.01 grid is not a valid price and raises — the exchange
        quantises price and refuses anything between ticks.
        """
        p = Decimal(str(price))
        ratio = p / self.tick_size
        snapped = ratio.to_integral_value(rounding=ROUND_HALF_UP)
        if ratio != snapped:
            raise ValueError(
                f"price {price} is off the {self.tick_size} tick grid for {self.symbol}"
            )
        return int(snapped)

    def to_price(self, ticks: int) -> Decimal:
        """Convert integer ticks back to a human price."""
        return (Decimal(ticks) * self.tick_size).quantize(self.tick_size)

    # --- quantity validation --------------------------------------------
    def validate_qty(self, qty: int) -> int:
        if not isinstance(qty, int) or isinstance(qty, bool):
            raise TypeError("quantity must be an int (lots/units), never a float")
        if qty <= 0:
            raise ValueError("quantity must be positive")
        if qty % self.lot_size != 0:
            raise ValueError(
                f"quantity {qty} is not a multiple of lot_size {self.lot_size}"
            )
        return qty
