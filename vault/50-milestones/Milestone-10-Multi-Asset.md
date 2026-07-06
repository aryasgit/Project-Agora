# Milestone 10 — Advanced Extensions: Multi-Asset

**Status:** 🟢 Built (2026-07-06). First of the optional extensions.

## What was built
The console now trades **four independent instruments at once**, each with its own order book, matching engine, and trader population — proving the central claim that *the matching engine is instrument-agnostic*. Only the contract's character differs.

| Symbol | Kind | Opening | Character (trader mix) |
|--------|------|---------|------------------------|
| AGORA | index | $50.00 | balanced, healthy two-sided |
| TITAN | large-cap | $128.50 | deep MMs, calm, tight spreads |
| NOVA | small-cap | $8.40 | thin, momentum-driven, jumpy |
| HELIX | ETF | $315.00 | steady basket |

Verified in-browser: NOVA's realized volatility (~15bp) is an order of magnitude above AGORA's (~0.8bp) — the small-cap genuinely behaves like a small-cap.

## Design
- `lib/world.ts` — `World` holds N `Market`s (`{spec, sim, config, preset}`). `World.step()` advances **every** market each frame, so the watchlist stays live even for symbols you aren't viewing. Distinct per-instrument seed (`seed + i*7919`) so they don't move in lockstep.
- `Simulation` gained a `startMid` parameter (per-instrument opening price); everything else (matching, traders, analytics) is unchanged — the engine didn't need to know about "multi-asset" at all. That's the whole point.
- UI: a **watchlist / symbol-switcher** bar (symbol · kind · last · %change vs open). Selecting a symbol swaps the chart, book, tape, analytics, order ticket, and trader mix to that instrument. Per-instrument trader mix + preset are remembered.

## Interview angle
"How did you add multi-asset?" → *"I didn't touch the matching engine. An exchange runs one independent book per instrument; the engine is asset-agnostic, so multi-asset is just N engines plus a router. The only per-instrument state is the contract's parameters (price level, tick, trader character) — exactly what real venues do."*

## Remaining Module 10 ideas (not yet built)
- Options/futures **on** an instrument (derivative contracts referencing an underlying book).
- Transaction costs / maker-taker fees.
- Latency simulation & explicit queue-position modelling.
- A risk engine / position & PnL tracker for the manual "YOU" trader across symbols.
- Reinforcement-learning agent.

See [[Roadmap]], [[Engine-Architecture]], [[Financial-Instruments]].
