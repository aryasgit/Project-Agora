# Project Agora — Teardown & Pruning Audit

*A candid, internal map of everything in the project — what it is, where it lives, what it costs to understand, and my honest keep/cut/simplify verdict. Built for a conversation about reducing complexity, not for a recruiter. Prepared 2026-07-06.*

---

## 0. The honest headline

You're right on both counts:

1. **It grew faster than you can re-derive it.** The project is ~2,200 LOC of engine/logic (Python + TypeScript) + ~1,600 LOC of UI/CSS across **~20 source files and 11 on-screen panels**. Most of it was written in one long session. That's a real "understanding debt."
2. **It reads as spectacle, not diagnosis.** It auto-plays at animation-frame speed, everything moves at once, and there's no default mode that says *"stop, here is one event, here is what it did."* The Scenario Lab is the one genuinely diagnostic surface, and it's hidden behind a button. A first-time viewer feels overwhelmed, not informed.

The good news: the **core is small and clean** (the matching engine is ~200 lines and fully tested). Almost all the "overwhelm" is in the presentation layer and in *breadth of features*, both of which are cheap to trim. **Nothing structural has to be torn out to make this calmer and more legible.**

The single biggest complexity driver is architectural, not a feature: **the matching engine exists twice** — once in Python (tested reference) and once in TypeScript (what actually runs in the browser). See §4.

---

## 1. The system in one map

```
TWO ENGINES (this is the #1 thing to understand):
  engine/agora/        Python — the TESTED REFERENCE. Runs headless, 26 tests, benchmark.
  web/console/lib/      TypeScript PORT of the same rules — what the live site actually runs.
                        The Python engine never runs in production. See §4.

DATA FLOW (browser):
  traders.ts → generate orders → engine.ts (order book + matching) → trades
       ↑                                    ↓
  simulation.ts (steps the market, records history) → world.ts (4 instruments)
       ↓
  page.tsx (60fps render loop) → 11 UI panels
       ↓
  scenario.ts (forks the sim for controlled experiments) → ScenarioLab.tsx
```

**If you understand three files, you understand 80% of the project:**
- `web/console/lib/engine.ts` — the order book + matching (the heart).
- `web/console/lib/simulation.ts` — how a step works and what gets recorded.
- `web/console/app/page.tsx` — how it all gets drawn and driven.

---

## 2. Complete feature inventory

Columns: **Understand** = how hard to reverse-engineer (🟢 easy / 🟡 moderate / 🔴 hard). **Verdict** = my recommendation.

### Engine core (Python `engine/agora/`, mirrored in TS `web/console/lib/`)

| Feature | Lives in | LOC | What it does | Understand | Verdict |
|---|---|---|---|---|---|
| Instrument / integer ticks | `instrument.py` / `engine.ts` | 61 | Price grid, lot grid, off-grid rejection; prices stored as int ticks | 🟢 | **CORE — keep** |
| Order & Trade model | `orders.py` / `engine.ts` | 71 | MARKET/LIMIT/STOP/STOP-LIMIT, GTC/IOC/FOK, latency field | 🟢 | **CORE — keep** (STOP + FOK/IOC are rarely demoed; could trim, see §5) |
| Order book | `book.py` / `engine.ts` | 235 | Two sorted sides, price levels, FIFO queues, depth, best-of-book | 🟡 | **CORE — keep** |
| Matching engine | `engine.py` / `engine.ts` | 204 | Price-time priority, partial fills, cancel, modify, stop cascades | 🟡 | **CORE — keep** (the crown jewel) |
| Queue position | `book.py` / `engine.ts` | (in book) | Lots-ahead / rank of a resting order | 🟢 | **KEEP — differentiator** |
| Latency model | `traders.py`, `simulation.py` | small | Per-order latency; orders arrive in latency order | 🟡 | **KEEP — differentiator**, but subtle/invisible; see §3 |
| 6 trader agents | `traders.py` / `traders.ts` | 186/151 | MM, momentum, mean-reversion, noise, aggressive, passive | 🟡 | **KEEP** — but 6 is a lot; 4 would do (see §5) |
| Analytics | `analytics.py` / in `simulation.ts` | 121 | VWAP, spread, imbalance, volatility, depth, frequency | 🟢 | **KEEP** (core to "diagnosis") |
| Simulation runner | `simulation.py` / `simulation.ts` | 111/359 | Steps traders → engine → analytics; records history | 🟡 | **CORE — keep** (TS version is bloated by history recording) |
| Throughput benchmark | `benchmark.py` | 76 | ~95k orders/sec number | 🟢 | **KEEP** (cheap, high signal, isolated) |

### Console UI (`web/console/`)

| Feature | Lives in | LOC | What it does | Understand | Verdict |
|---|---|---|---|---|---|
| Depth map (heatmap) | `DepthMap.tsx` | 165 | Bookmap-style liquidity heatmap, canvas/ImageData | 🔴 | **KEEP — the wow**, but it's the hardest file to understand |
| Candlestick chart | `CandleChart.tsx` | 113 | Custom canvas candles | 🟡 | **SIMPLIFY** — redundant with depth map; consider cutting one |
| Order book ladder | in `page.tsx` | — | Depth ladder w/ cumulative + bars | 🟢 | **CORE — keep** |
| Time & sales tape | in `page.tsx` | — | Trade tape, colored by side | 🟢 | **CORE — keep** |
| Analytics + sparklines | in `page.tsx`, `Sparkline.tsx` | 49 | Stat grid + spread/imbalance history lines | 🟢 | **KEEP** |
| Order ticket + slippage | `OrderTicket.tsx` | 113 | Manual order, fill receipt, slippage | 🟢 | **KEEP** |
| Queue panel | `QueuePanel.tsx` | 49 | Your queue position, live | 🟢 | **KEEP — differentiator** |
| Trader-mix sliders | `TraderControls.tsx` | 51 | Live agent-count sliders | 🟢 | **OVERLAP** with presets + Scenario Lab (see §5) |
| Scenario presets | in `TraderControls.tsx` | — | Calm/Flash Crash/Liquidity Crisis buttons | 🟢 | **OVERLAP** with Scenario Lab interventions |
| Multi-asset watchlist | `world.ts`, `page.tsx` | 81 | 4 instruments, symbol switcher | 🟡 | **SIMPLIFY** — 4× the state; 1–2 would cut cognitive load a lot |
| Scenario Lab | `ScenarioLab.tsx`, `scenario.ts` | 257/281 | Fork market → A/B experiment → decision report | 🔴 | **KEEP — the thesis**, but it's the 2nd-hardest area |
| Status bar | in `page.tsx` | — | Live/step/seed/latency legend | 🟢 | **KEEP** (cheap, sets the tone) |
| Collapsible rail, keyboard, URL seed | in `page.tsx` | — | Ergonomics | 🟢 | **KEEP** (cheap) |
| Brutal theme | `globals.css` | 1174 | The whole look | 🟡 | **KEEP** — but the CSS is large and could be tokenized |

### Knowledge base
| Feature | Lives in | Count | Verdict |
|---|---|---|---|
| Obsidian vault | `vault/` | 28 notes | **KEEP** — this is your reverse-engineering manual; lean on it |

---

## 3. The real problem: spectacle vs. diagnosis

Your instinct is correct and it's a *design* problem, not a code problem. Concretely, why it feels overwhelming and can't be "read":

- **It auto-plays at 60fps and never stops.** Default state is running, fast. Nothing invites you to inspect a single event.
- **Everything animates simultaneously** — book, tape, depth map, sparklines, watchlist prices all move at once. No focal point.
- **The most "microstructure" mechanics are invisible in motion** — latency and queue position only mean something if you can freeze and look. At speed they're a blur.
- **No narration.** Nothing says *"a 400-lot buy just swept 3 levels and moved the price 0.06."* You have to already know what you're seeing.

**Cheap fixes that would flip it from spectacle to diagnosis (not yet built — for discussion):**
1. **Default to PAUSED**, at 1×, with a big "Step" affordance. Let the user *drive*, not watch.
2. **Event-step mode:** advance one *order* at a time, highlight the incoming order, show the book delta it caused. This is the single highest-value change for understanding.
3. **A "what just happened" narration line** — one sentence per significant event (sweep, spread widen, stop trigger).
4. **Progressive disclosure:** start with 3 panels (chart, book, tape). Reveal analytics / scenario / multi-asset on demand. 11 panels at once is the overwhelm.
5. **Slow the default speed** and make the depth map’s time axis longer so patterns are readable, not a strobe.

*My recommendation: this is where the next effort should go — not more features. One "diagnostic mode" would do more for the project than anything in §5.*

---

## 4. The biggest complexity cost: two engines

The matching rules exist in **both** `engine/agora/*.py` (tested, ~1,088 LOC) and `web/console/lib/*.ts` (~1,128 LOC). The Python one **never runs in production** — the browser runs the TypeScript port.

- **Why it's like this:** a deliberate call (vault ADR-0003) so the live demo deploys to Vercel with no backend, while keeping a tested Python reference.
- **What it costs:** every rule change must be made twice; two things to understand; risk of drift.
- **Options to discuss:**
  - **(a) Keep both**, but treat Python as frozen reference you rarely touch. (Current stance. Fine if you stop changing the engine.)
  - **(b) Collapse to TypeScript only** — add a small TS test suite (port the 26 pytest cases), delete the Python engine. Loses the "pure Python, tested" CV line but halves the surface.
  - **(c) Collapse to Python only** — run it in the browser via Pyodide/WASM. Removes duplication but adds a heavy WASM dependency and slower startup. Probably not worth it.
  - **My lean:** if you value the Python engine for interviews (you should — "pure, tested Python matching engine" is a strong line), keep **(a)** but *freeze* it. If you never plan to discuss the Python side, **(b)** is the honest simplification.

---

## 5. If you were cutting — a tiered plan

**Tier 1 — Minimal Viable Agora (what the project fundamentally IS).** If you rebuilt to understand it, build only this:
- Instrument (int ticks) · Order/Trade (just MARKET + LIMIT + GTC) · Order book · Matching engine · a couple of trader agents (market maker + noise) · order ticket · book ladder + tape · one price view.
- ~600 LOC of logic. Fully understandable in an afternoon. Still demonstrates price-time priority, emergence, and market impact.

**Tier 2 — The differentiators worth keeping:**
- Queue position + latency (this is what makes it "microstructure", not "a book").
- Scenario Lab (this is what makes it "decision intelligence", not "a sim").

**Tier 3 — Impressive but prunable (overlap / breadth):**
- **Multi-asset (4 → 1 or 2):** biggest single cognitive-load cut. The 15×-volatility small-cap is a nice demo; keep 2 instruments, drop 2.
- **Candles OR depth map, not both:** they show the same price two ways. Depth map is the wow; candles are the familiar. Pick one as default, maybe drop the other.
- **Trader-mix sliders + presets + Scenario-Lab interventions overlap.** Three ways to change the market. Consider: sliders = live tinkering, Scenario Lab = rigorous experiment, and **cut the presets** (they're a weaker version of Scenario Lab).
- **STOP / STOP-LIMIT / FOK order types:** correct and tested, but rarely demoed. Keep in the engine (cheap, tested) but you don't need to surface them in the UI.

**Tier 4 — Cheap, keep:** benchmark, status bar, keyboard shortcuts, URL seed, vault.

---

## 6. Speed & performance (facts)

- **Matching engine:** ~90–95k orders/sec single-threaded, pure CPython (`python -m agora.benchmark`). Not a bottleneck.
- **Browser sim:** steps run in well under a millisecond; the 60fps render loop is the real cost, and it's fine.
- **Scenario Lab:** 8 seeds × 2 branches × 200 steps ≈ 3,200 steps, computes in a few hundred ms synchronously (you saw the ~1s "running" state — mostly the setTimeout guard).
- **Bundle:** ~101 kB first-load JS, fully static. Deploy is instant. **Performance is not a problem anywhere.** The problem is cognitive, not computational.

---

## 7. Questions to take into the discussion

1. **Is the Python engine worth maintaining** if the browser runs the TS port? (Keep-frozen vs. delete — §4.)
2. **How many instruments** do you actually need to make the point? (I'd argue 1–2, not 4.)
3. **Candles or depth map** as the one price view?
4. **Do the trader-mix presets earn their place** next to the Scenario Lab, or are they a weaker duplicate?
5. **Would a "diagnostic mode"** (paused-by-default, step-one-order, narration) do more for the project than any remaining feature? (I think yes — §3.)
6. **What is the ONE thing you want a viewer to understand** in 60 seconds? Right now the UI doesn't choose. Choosing would let you cut everything that doesn't serve it.

---

## 8. My one-paragraph recommendation

Don't tear anything out yet. The engine is small, clean, and tested — that's not the problem. The problem is that the **presentation optimises for "impressive" over "legible."** Spend the next effort on a **diagnostic mode** (pause-by-default, step one order at a time, a narration line, fewer panels on first load) and on **cutting breadth you don't demo** (4 instruments → 2, presets → gone, one price chart). That turns Agora from "a fast thing you watch" into "a tool you use to understand a market" — which is exactly what you said you wanted, and exactly what the Decision-Intelligence framing promises. Everything needed for that is already here; it needs *subtraction and pacing*, not more building.
