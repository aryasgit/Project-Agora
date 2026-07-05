# ADR-0003 — Console runtime: client-side TypeScript engine

**Status:** Accepted (2026-07-05)

## Context
The shipped console must (a) deploy cleanly to Vercel and (b) feel *live* — a market ticking in real time. The reference engine is Python. Options for driving the UI:
1. FastAPI server hosting the Python engine (needs a long-lived Python host; awkward on Vercel's serverless/edge model, and stateful sims don't fit serverless well).
2. Python serverless functions on Vercel (stateless; re-running a whole sim per request; cold starts; engine-packaging friction).
3. **Port a compact engine to TypeScript and run the simulation client-side in the browser.**

## Decision
Option 3. The Next.js console contains a faithful TS port (`lib/engine.ts`, `lib/traders.ts`) of the core: integer-tick order book, price-time-priority matching, partial fills, and the key trader agents. The market runs in the browser via `requestAnimationFrame`, so the console is genuinely live with **zero backend** → trivial, reliable Vercel deploy (static/edge).

The **Python engine remains the source of truth**: it is the tested (`pytest`) reference implementation and the local research tool. The TS port mirrors its rules; any divergence is a bug in the port.

## Consequences
- Deploy is a plain Next.js app — no Python at runtime, no server state.
- One duplication cost: matching rules exist in two languages. Mitigation — the TS port is deliberately minimal (the subset the visual needs), and both are documented against the same [[Price-Time-Priority]] spec.
- Fully offline/interactive: users can change trader mix and reseed live.

Related: [[ADR-0001-stack]], [[Engine-Architecture]].
