# Roadmap

Ten milestones. We do **not** advance until the current milestone's reflection questions are answered. Target: ~2–3 weeks of focused work → a portfolio piece.

| # | Milestone | Output | Status |
|---|-----------|--------|--------|
| 1 | Exchange Fundamentals | Vault notes: participants & how they interact | 🟡 In progress |
| 2 | Financial Instruments | Notes: instruments, tick/lot sizes | ⚪ Not started |
| 3 | Order Types | `Order` model + order-type semantics | ⚪ Not started |
| 4 | Order Book | `OrderBook` data structure, depth, BBO | ⚪ Not started |
| 5 | Matching Engine | Price-time priority matcher, fills, cancel/modify | ⚪ Not started |
| 6 | Simulated Traders | Agent classes (random, momentum, mean-reversion, MM…) | ⚪ Not started |
| 7 | Market Dynamics | Emergent price formation, spreads, volatility studies | ⚪ Not started |
| 8 | Analytics Layer | VWAP, spread, imbalance, depth, liquidity metrics | ⚪ Not started |
| 9 | Dashboard / Console | TradingView-style UI (black + red/green) | ⚪ Not started |
| 10 | Advanced Extensions | Multi-asset, latency, risk engine (optional) | ⚪ Not started |

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
