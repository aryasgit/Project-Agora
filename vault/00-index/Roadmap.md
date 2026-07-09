# Roadmap

Ten milestones. We do **not** advance until the current milestone's reflection questions are answered. Target: ~2–3 weeks of focused work → a portfolio piece.

| # | Milestone | Output | Status |
|---|-----------|--------|--------|
| 1 | Exchange Fundamentals | Vault notes: participants & how they interact | 🟢 Done |
| 2 | Financial Instruments | `Instrument` value object, integer-tick design | 🟢 Done |
| 3 | Order Types | `Order`/`Trade` model, MARKET/LIMIT/STOP/STOP_LIMIT, GTC/IOC/FOK | 🟢 Done |
| 4 | Order Book | `OrderBook` (SortedDict + deque), depth, BBO | 🟢 Done |
| 5 | Matching Engine | Price-time priority, full/partial fills, cancel/modify, stops | 🟢 Done |
| 6 | Simulated Traders | Random, MM, momentum, mean-reversion, aggressive, passive | 🟢 Done |
| 7 | Market Dynamics | Emergent price series from `Simulation` runner | 🟢 Done |
| 8 | Analytics Layer | VWAP, spread, imbalance, depth, volatility, frequency | 🟢 Done |
| 9 | Dashboard / Console | TradingView-style UI (black + red/green), **live on Vercel** | 🟢 Done |
| 10 | Advanced Extensions | **Multi-asset + latency/queue-position + throughput benchmark done**; options/fees open | 🟡 In progress |

**Legend:** 🟢 done · 🟡 in progress · ⚪ not started

## Architecture at a glance (target)
```
agora/            ← pure-Python simulation engine (no UI deps)
  orders.py       ← Order, Side, OrderType  (Milestone 3)
  book.py         ← OrderBook                (Milestone 4)
  engine.py       ← MatchingEngine           (Milestone 5)
  traders/        ← agent behaviours         (Milestone 6)
  analytics.py    ← metrics                  (Milestone 8)
web/              ← FastAPI + Next.js console (Milestone 9, → Vercel)
tests/            ← pytest, engine-first
```
Design rule: **the engine never imports the web layer.** The UI is a thin viewer over a self-contained simulator. This keeps the core interview-defensible and independently testable.

## Deployment decision (see [[ADR-0001-stack]])
Streamlit is great for a *local* research view, but does not give the strict TradingView-style console the project targets, and deploys awkwardly to Vercel. Plan: **FastAPI (engine API) + Next.js console on Vercel**, with an optional Streamlit notebook for quick local exploration.
