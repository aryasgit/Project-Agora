"""Agora — a first-principles electronic exchange simulator.

Public API is intentionally small: build an Instrument, feed Orders into a
MatchingEngine, and read Trades + book state back out. The engine has no
dependency on any web/UI layer (see vault ADR-0001).
"""
from .instrument import Instrument
from .orders import Order, Side, OrderType, TimeInForce, Trade
from .book import OrderBook, PriceLevel
from .engine import MatchingEngine

__all__ = [
    "Instrument",
    "Order",
    "Side",
    "OrderType",
    "TimeInForce",
    "Trade",
    "OrderBook",
    "PriceLevel",
    "MatchingEngine",
]
