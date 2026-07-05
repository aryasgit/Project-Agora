# Guide — Engine Architecture (as built)

The `agora` engine is a pure-Python package under `engine/agora/`, with **zero UI dependencies**. This is the study map: read the source alongside these notes.

## Module map
| File | Responsibility | Milestone |
|------|----------------|-----------|
| `instrument.py` | `Instrument` — symbol, tick grid, lot grid; price↔ticks conversion, off-grid rejection | 2 |
| `orders.py` | `Order`, `Trade`, and the enums `Side` / `OrderType` / `TimeInForce` | 3 |
| `book.py` | `OrderBook` + `PriceLevel` — the two-sided sorted book | 4 |
| `engine.py` | `MatchingEngine` — price-time priority matching, cancel, modify, stops | 5 |
| `traders.py` | Agent behaviours (random, MM, momentum, mean-reversion, …) | 6 |
| `analytics.py` | `Analytics` + `Snapshot` — VWAP, spread, imbalance, volatility | 8 |
| `simulation.py` | `Simulation` runner that steps traders → engine → analytics | 6/7 |

## Key design decisions (study these — they're interview gold)
1. **Integer ticks everywhere.** Prices are `int` tick counts; quantities are `int` units. Floats never key the book. `Instrument.to_ticks("50.005")` *raises* — off-grid prices are rejected, not silently rounded. (ADR-0002 rationale.)
2. **Book = `SortedDict[int, PriceLevel]` per side.** Bids stored under **negated keys** so the natural ascending order puts the *best bid* (highest price) first — O(1) best-of-book, O(log n) level insert/remove.
3. **Price level = `deque` of orders.** FIFO append/popleft *is* the "time" in price-time priority. The front of the queue is the next to fill.
4. **Matching is a while-loop** that repeatedly hits the best opposite level until the incoming order is filled or can no longer cross. Partial fills fall out naturally; the remainder rests (GTC), is discarded (MARKET), or cancelled (IOC/FOK).
5. **`modify` is cancel-replace** and deliberately **loses time priority** — a real exchange behaviour, and a great interview question ("why isn't modify free?").
6. **Stops are parked** until `last_price` crosses their trigger, then converted to MARKET/LIMIT and matched; triggering **cascades** (a stop can trip another stop) — the mechanism behind flash crashes.

## How the price emerges (Module 7)
No component sets a price. `simulation.py` steps each trader; a `MarketMaker` posts two-sided quotes, noise traders and momentum/mean-reversion agents take and add liquidity, and the **top of the book is the price**. Run `python -m agora.simulation` from `engine/` to see ~1000 emergent trades and a summary.

## Running it
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest                       # 21 tests, engine-first
cd engine && python -m agora.simulation   # emergent-market smoke run
```

See also: [[Order-Book]], [[Price-Time-Priority]], [[ADR-0001-stack]].
