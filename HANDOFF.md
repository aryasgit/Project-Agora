# Project Agora — Handoff & CV Brief

*Electronic Exchange & Market-Microstructure Research Platform. Updated 2026-07-06.*

**Live console → https://console-ecru-omega.vercel.app** · **Repo → github.com/aryasgit/Project-Agora**

---

## 1. What it is (one line)
A first-principles **electronic exchange simulator**: a limit order book, a price-time-priority matching engine, a population of interacting trading agents, and an analytics layer — packaged as a tested, importable Python engine plus a live, brutal-black trading console (Next.js on Vercel) and a knowledge vault documenting every concept and decision. Prices are never set; they **emerge** from order flow.

## 2. What it is (the fuller picture)
Most people breaking into quant build a *backtester* — they take historical prices and test whether a signal would have made money. Agora builds the thing underneath that: **the exchange itself.** It models how a real venue works internally — orders arriving, resting in a book, matching by strict priority rules, and a price *emerging* from the collision of buyers and sellers. Then it populates that exchange with autonomous trading agents (market makers, momentum chasers, institutions) and lets a market form on its own, which you watch and trade into through a professional-grade console.

It answers the question a backtester never asks: **where does a price actually come from, and why does liquidity appear and vanish?** That's market microstructure — the domain of the matching-engine, market-making, and execution desks at firms like Jane Street, HRT, Citadel Securities, and Optiver.

## 3. Architecture
The simulation logic lives in one pure-Python package (`engine/agora/`) with **zero UI dependencies** — it runs headless in a notebook, a test, or the throughput benchmark. The web console runs a faithful TypeScript **port** of that engine client-side, so the deployed demo needs no backend. The Python engine is the tested source of truth.

```
engine/agora/
  instrument.py   symbol + integer tick/lot grid; off-grid prices rejected
  orders.py       Order / Trade; MARKET·LIMIT·STOP·STOP_LIMIT; GTC·IOC·FOK; per-order latency
  book.py         OrderBook — SortedDict(price) → deque(orders); depth + queue-position
  engine.py       MatchingEngine — price-time priority, fills, cancel/modify, stop cascades
  traders.py      6 agent behaviours, each with a latency profile
  analytics.py    VWAP, spread, order imbalance, realized volatility, depth
  simulation.py   runner: latency-ordered arrival → engine → analytics → heatmap history
  benchmark.py    throughput harness
web/console/
  lib/            engine.ts · traders.ts · simulation.ts · world.ts  (TS engine port)
  components/     DepthMap · CandleChart · OrderTicket · TraderControls · QueuePanel · Sparkline
  app/            the console + brutal theme (globals.css)
tests/            pytest — 26 cases, engine-first
vault/            Obsidian knowledge base — concepts, ADRs, glossary, milestones
```

**Scale:** ~1,090 LOC in the core Python engine (9 modules) with **26 passing tests** (300 LOC); ~1,780 LOC of TypeScript/React in the console (6 components); 26 vault notes; deployed on Vercel.

## 4. Capabilities (what it can actually do)

**Exchange core**
- Full **limit order book** — bid/ask sides, price levels, market depth, best-bid/ask.
- **Matching engine** with **price-time priority**: full & partial fills, order cancel, cancel-replace modify (correctly forfeits time priority), STOP / STOP-LIMIT triggers with **cascading** (one stop can trip the next — the flash-crash mechanism).
- Order types: **MARKET, LIMIT, STOP, STOP-LIMIT**; time-in-force: **GTC, IOC, FOK**.
- **Integer-tick arithmetic** — prices stored as integer ticks, off-grid prices rejected, so floats never key the book.

**Microstructure depth (the differentiators)**
- **Latency & queue position** — every order carries a latency (fast market makers colocate, retail is slow); orders arrive in latency order, and a `queue_position` primitive exposes exactly how many lots sit *ahead* of a resting order — the real driver of fill probability and adverse selection. Surfaced live in the console.
- **Liquidity Depth Map** — a Bookmap-style time×price heatmap (log-intensity resting volume, asks red / bids green, executions as white strikes, last-price trace) as the default chart. Makes liquidity *visible as a substance*: walls building, the book hollowing out mid-crash.
- **6 trading agents** — market maker (two-sided quotes with inventory skew), momentum, mean-reversion, noise, aggressive institutional, passive — whose order flow *produces* an emergent price series.
- **Analytics** — VWAP, bid-ask spread + history, order imbalance, realized volatility, market depth, trade frequency, with live sparklines.

**Multi-asset & interaction**
- **4 independent instruments** (index / large-cap / small-cap / ETF), each its own book; a live watchlist + symbol switcher. Character differs — the thin small-cap runs ~15× the index's volatility.
- **Manual order ticket** — fire your own order into the live book, see filled qty, average price, and **slippage vs the pre-trade mid** (market impact, made tangible), and watch your queue position.
- **Live trader-mix editor** + scenario presets (**Calm / Flash Crash / Liquidity Crisis**) that reshape the running market with no reset.
- Keyboard shortcuts, URL-shareable reproducible seeds, responsive layout, collapsible instrument panel.

**Performance**
- Matching engine sustains **~90–95k orders/sec single-threaded in pure CPython** (verified by `agora.benchmark`, realistic limit/market/cancel mix, no C extensions).

## 5. What the platform demonstrates (the intellectually honest part)
It's a **research/teaching simulator**, not a source of alpha and not calibrated to real order-flow data — the agents are stylized. Framed that way, it correctly reproduces the core mechanisms of a real market:
- **Price discovery is emergent** — no component sets the price; the top of the book *is* the price.
- **Market impact is measurable** — a large market order walks the book and pays progressively worse prices (e.g. an 8-lot buy averaging 50.1375 against a book that reads 50.10 on top). Firable from the console with a live slippage readout.
- **Queue position governs fills, and latency governs queue position** — the race to the front of the FIFO queue is explicit and visible.
- **Regime is set by the trader mix, not a price model** — more makers → tight spreads; more momentum + fewer makers → a self-reinforcing flash crash, watchable on the depth map as liquidity withdraws.
- **Order imbalance leads short-term price pressure** — one of the most-used real microstructure signals, computed and charted.

## 6. Tech stack
**Engine:** Python 3.14 · `sortedcontainers` (order-book structure) · pytest (26 tests). Pure, dependency-light, importable, headless-runnable.
**Console:** TypeScript · Next.js 14 / React · custom `<canvas>` rendering for the depth map (offscreen `ImageData`, hard-pixel upscale) and candlesticks — **no chart library**, for exact control and a tiny bundle · Inter via `next/font` · deployed on **Vercel** as a static/edge app (no backend, no database, no secrets).
**Design system:** brutal exchange-terminal aesthetic — true-black surfaces, 1px hairline separation, red as the system color (green data-only), documented in `web/console/DESIGN.md` + `PRODUCT.md`.
**Design decisions** recorded as ADRs in the vault: engine/UI separation (ADR-0001), integer-tick arithmetic (ADR-0002), client-side engine port for a backend-free deploy (ADR-0003).

---

## 7. CV bullets (quant / microstructure-tailored — pick 2–4)

**Headline:**
> **Electronic Exchange Simulator** — Built a first-principles limit-order-book matching engine in Python enforcing **price-time priority** (full/partial fills, cancel/modify, stop-order cascades) across MARKET/LIMIT/STOP order types and GTC/IOC/FOK time-in-force, sustaining **~90k orders/sec single-threaded**, with a 26-case test suite.

**Data-structures / systems:**
> Designed the order book for correctness and speed — integer-tick prices (off-grid prices rejected so floats never key the book), a `SortedDict` of price levels for O(1) best-of-book and O(log n) level maintenance, and FIFO queues encoding time priority — keeping the matching engine a pure, dependency-free, independently testable module.

**Microstructure depth (matching-engine / market-making signal):**
> Modelled per-order latency with latency-ordered arrival and a queue-position primitive (lots-ahead / rank at a price level), and visualised order-book liquidity as a real-time Bookmap-style heatmap — demonstrating how latency wins queue priority and how queue position drives fill probability and adverse selection.

**Full-stack / product:**
> Shipped an interactive, brutal-black trading console (Next.js, custom-canvas depth-map + candlestick rendering) running the matching engine live in the browser — manual order ticket with slippage, live trader-mix editor with flash-crash/liquidity-crisis scenarios, and multi-asset support — deployed backend-free on Vercel.

*ATS keywords: order book, matching engine, price-time priority, market microstructure, queue position, latency, bid-ask spread, market impact, liquidity, order imbalance, VWAP, limit/market/stop orders, IOC/FOK, market making, Python, TypeScript, Next.js.*

---

## 8. Honest take

**Strong and differentiated.** Almost everyone breaking into finance builds a backtester; very few build the exchange. Agora sits on the higher-status side of the field — the matching-engine / market-making / execution world — and now has a signature visual (the liquidity depth map) that most professional tools charge for. It pairs naturally with a backtesting project: one shows you can *evaluate* strategies, this shows you understand the *market they trade in*.

**Lead with:** the tested pure matching engine (price-time priority, defensible `SortedDict`+`deque` data structures, ~90k orders/sec), the latency/queue-position model, and the live depth map. Open the demo, hit Flash Crash, and say "watch the liquidity leave."

**Name these before they do:** the agents are stylized (not calibrated to real data — it explains *mechanisms*, not real magnitudes); the console runs a TS port of the Python engine (a deliberate call for a backend-free deploy — two implementations of the matching rules, mitigated by the Python side being the tested reference); and there's no fee model or cross-venue/NBBO layer yet (the honest "what's next").

**Bottom line:** genuinely flagship-tier for matching-engine, market-making, and execution roles — built with real systems discipline and demonstrated honestly.
