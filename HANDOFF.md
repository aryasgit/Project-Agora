# Project Agora — Handoff & CV Brief

*Electronic Exchange & Market-Microstructure Research Platform. Prepared 2026-07-06.*

---

## 1. What it is (one line)
A first-principles **electronic exchange simulator**: a limit order book, a price-time-priority matching engine, a population of interacting trading agents, and an analytics layer — packaged as a tested, importable Python engine plus a live, interactive TradingView-style console (Next.js on Vercel) and a knowledge vault documenting every concept and decision. Prices are never set; they **emerge** from order flow.

## 2. Architecture
The simulation logic lives in one pure-Python package (`engine/agora/`) with **zero UI dependencies** — it runs headless in a notebook or a test. The web console runs a faithful TypeScript **port** of that engine client-side, so the deployed demo needs no backend. The Python engine is the tested source of truth.

```
engine/agora/
  instrument.py   symbol + integer tick/lot grid; off-grid prices rejected
  orders.py       Order / Trade; MARKET·LIMIT·STOP·STOP_LIMIT; GTC·IOC·FOK
  book.py         OrderBook — SortedDict(price) → deque(orders) per side
  engine.py       MatchingEngine — price-time priority, fills, cancel/modify, stops
  traders.py      6 agent behaviours on one interface
  analytics.py    VWAP, spread, order imbalance, realized volatility, depth
  simulation.py   runner: steps traders → engine → analytics
web/console/
  lib/            engine.ts · traders.ts · simulation.ts · world.ts  (TS engine port)
  components/     CandleChart · OrderTicket · TraderControls · Sparkline
  app/            the console (canvas chart, book ladder, tape, analytics, rail)
tests/            pytest — 26 cases, engine-first
  benchmark.py    throughput harness — ~95k orders/sec single-threaded
vault/            Obsidian knowledge base — concepts, ADRs, glossary, milestones
```

**Scale:** ~1,090 LOC in the core Python engine (9 modules incl. a throughput benchmark) with **26 passing tests** (300 LOC); ~1,550 LOC of TypeScript/React in the console; 26 vault notes; deployed on Vercel.

**Live console → https://console-ecru-omega.vercel.app** · **Repo → github.com/aryasgit/Project-Agora**

## 3. What was actually built (by module)

| Module | Deliverable |
|---|---|
| 1–2 | Foundations — market participants, instruments; **integer-tick design** (prices stored as int ticks, off-grid prices rejected — floats never key the book) |
| 3 | Order model — MARKET / LIMIT / STOP / STOP-LIMIT order types; GTC / IOC / FOK time-in-force |
| 4 | **Limit order book** — two sorted sides (`SortedDict` keyed by tick price, best-bid stored under negated key for O(1) best-of-book), FIFO `deque` per price level, market-depth + cumulative-depth introspection |
| 5 | **Matching engine** — price-time priority; full & partial fills; order cancel; cancel-replace modify (correctly forfeits time priority); STOP/STOP-LIMIT trigger with **cascading** |
| 6 | **6 trading agents** — market maker (two-sided quotes with inventory skew), momentum, mean-reversion, noise/random, aggressive institutional, passive seller |
| 7 | **Market dynamics** — a `Simulation` runner where a coherent price series *emerges* from agent interaction (~1,000 trades in a default run) |
| 8 | **Analytics** — VWAP, bid-ask spread + history, order imbalance, realized volatility, market depth, trade frequency |
| 9 | **Interactive console** — strict-black TradingView-style Next.js UI (custom-canvas candlesticks, depth ladder, time & sales, analytics sparklines); manual **order ticket with live slippage vs mid**; **live trader-mix sliders** + scenario presets (Calm / Flash Crash / Liquidity Crisis); keyboard shortcuts; URL-shareable seed; responsive; deployed to Vercel |
| 10 | **Multi-asset** — 4 independent instruments (index / large-cap / small-cap / ETF), each its own book, with a live watchlist + symbol switcher |
| 10+ | **Queue position & latency** — per-order latency (fast MMs colocate) with latency-ordered arrival; a `queue_position` primitive (lots ahead / rank at a level) surfaced live in the console. **Throughput benchmark**: ~95k orders/sec single-threaded, pure CPython |

## 4. What the platform demonstrates (the intellectually honest part)
This is a **research/teaching simulator**, not a source of alpha and not calibrated to real order-flow data — the agents are stylized. Framed that way, it correctly reproduces the core mechanisms of a real market:

- **Price discovery is emergent.** No component sets the price; the top of the book *is* the price, moved purely by order flow. You can watch a coherent series form from random-looking activity.
- **Market impact is measurable.** A large market order walks the book level by level and pays progressively worse prices — e.g. an 8-lot buy into asks of 5 @ 50.10 + 10 @ 50.20 fills at an average of **50.1375**, not the 50.10 on screen. This is *why* institutions slice orders, shown directly (and firable from the console's order ticket, which reports realized slippage).
- **Regime depends on the trader mix, not on any single "price model."** More market makers → tighter spreads and deeper liquidity; more momentum traders + fewer makers → a self-reinforcing **flash crash**. The console's scenario presets make this cause→effect visible live.
- **Character scales with liquidity.** The thin, momentum-driven small-cap (NOVA) runs ~15× the realized volatility of the deep index (AGORA) — an authentic small-cap signature that emerges from its trader population, not a hardcoded parameter.
- **Order imbalance is a signal.** Top-of-book bid/ask volume imbalance is computed and charted; it leads short-term price pressure, one of the most-used real microstructure signals.
- **Queue position governs fills — and latency governs queue position.** Orders arrive in latency order (fast market makers first), so the race to the front of the FIFO queue is explicit. The console shows exactly how many lots sit ahead of your resting order — the quantity that decides whether you fill and how much adverse selection you eat. This is the single most matching-engine/market-making-authentic idea in the project.

## 5. Tech stack
**Python 3.14** · `sortedcontainers` (order-book structure) · pytest.
**Web:** TypeScript · Next.js 14 / React · custom `<canvas>` charting (no chart library — deliberate, for exact aesthetic control + a tiny bundle) · Inter typography via `next/font` · deployed on **Vercel** as a static/edge app (no backend).
**Design decisions** recorded as ADRs in the vault: engine/UI separation (ADR-0001), integer-tick arithmetic (ADR-0002), client-side engine port for a backend-free deploy (ADR-0003).

---

## 6. CV bullets (quant / microstructure-tailored — pick 2–4)

**Headline version:**
> **Electronic Exchange Simulator** — Built a first-principles limit-order-book matching engine in Python enforcing **price-time priority** (full/partial fills, cancel/modify, stop-order cascades) across MARKET/LIMIT/STOP order types and GTC/IOC/FOK time-in-force, with a 21-case test suite.

**Data-structures / systems:**
> Designed the order book for correctness and speed — integer-tick prices (off-grid prices rejected so floats never key the book), a `SortedDict` of price levels for O(1) best-of-book and O(log n) level maintenance, and FIFO queues encoding time priority — sustaining **~95k orders/sec single-threaded in pure Python**, verified by a throughput benchmark.

**Microstructure depth (matching-engine / market-making signal):**
> Modelled per-order latency with latency-ordered arrival and a queue-position primitive (lots-ahead / rank at a price level), surfaced live in the console — demonstrating how latency wins queue priority and how queue position drives fill probability and adverse selection.

**Microstructure / simulation:**
> Modelled six interacting trader archetypes (market maker with inventory skew, momentum, mean-reversion, noise, institutional, passive) whose order flow produces an **emergent** price series, and built an analytics layer (VWAP, bid-ask spread, order imbalance, realized volatility, market depth) to quantify liquidity and market impact.

**Full-stack / product:**
> Shipped an interactive, strict-black TradingView-style trading console (Next.js, custom-canvas charting) running the matching engine live in the browser with a manual order ticket (live slippage), a real-time trader-mix editor with scenario presets (flash-crash / liquidity-crisis), and multi-asset support — deployed backend-free on Vercel.

*Keywords for ATS: order book, matching engine, price-time priority, market microstructure, bid-ask spread, market impact, liquidity, order imbalance, VWAP, limit/market/stop orders, IOC/FOK, market making, Python, TypeScript, Next.js.*

---

## 7. Is it a good project? Honest take

**Yes — and it's differentiated.** Almost every finance-breaking-in candidate builds a *backtester* (predict prices, report a Sharpe). Very few build the **exchange itself**. That's the higher-status half of the field — it's what the matching-engine, market-making, and execution teams at prop firms actually work on — and it signals you understand *where prices come from*, not just how to fit a signal to them.

**What lifts it:**
1. **It's the mechanics, not a prediction.** A working price-time-priority matcher with partial fills, cancel/modify semantics, and cascading stops is real systems work and an ideal whiteboard conversation starter.
2. **Data-structure intent.** Integer ticks, `SortedDict` + `deque`, O(1) best-of-book — you can defend every choice on complexity grounds. This is exactly what a matching-engine interview probes.
3. **Engine/UI separation + tests.** The engine is pure and independently tested; the UI is a thin viewer. Your ECE/systems background shows here and differentiates you from finance-only candidates.
4. **It's interactive and deployed.** An interviewer can open a live URL, fire an order, watch it walk the book, and trigger a flash crash. Very few candidate projects are drivable in the room.
5. **Intellectual honesty.** It's framed as a simulator of mechanisms, not "a profitable exchange" — and it makes market impact and regime-dependence *visible* rather than asserted.

**Where it's vulnerable (name these before they do):**
- **Stylized agents, not calibrated to real data.** The traders are archetypes, not fitted to historical order flow — so it explains *mechanisms*, not real-market magnitudes. Say this; it's the honest frame.
- **The console runs a TypeScript port of the engine, not the Python one** (a deliberate call for a backend-free deploy — ADR-0003). The trade-off is two implementations of the matching rules; mitigated by the Python engine being the tested reference. Good "engineering trade-off" talking point.
- **No fee model or cross-venue.** Latency and queue position are now modelled; the remaining realism gaps are maker-taker fees and multiple competing venues (SIP/NBBO). Naming these as the next layer shows you know what's still missing.

**The one high-leverage add (optional):** a **latency / queue-position** dimension — even a simple per-order delay so that where you sit in the FIFO queue matters — is the single most microstructure-authentic extension and the natural "what would you do next" answer. Not required for the portfolio; worth *saying*.

**Bottom line:** genuinely strong and unusually well-positioned for matching-engine / market-making / execution roles — *because* it's the exchange side, built with real systems discipline (integer ticks, tested pure engine, defensible data structures) and demonstrated honestly. It pairs naturally with a backtesting project: one shows you can *evaluate* strategies, this shows you understand the *market they trade in*.
