# Milestone 9 — Dashboard / Console

**Status:** 🟢 Built (2026-07-05) · deploy step pending your Vercel import.

## What was built
A live, TradingView-style exchange console at `web/console` (Next.js 14, TypeScript, custom canvas chart, strict black + red/green). The market runs **client-side** via a faithful TS port of the engine (see [[ADR-0003-console-runtime]]).

Panels:
- **Price chart** — custom canvas candlesticks (5-step candles), right-side price axis, live last-price tag.
- **Order book** — depth ladder, red asks / green bids, depth bars, live spread.
- **Time & Sales** — trade tape, colour-coded by aggressor side.
- **Analytics** — VWAP, volume, trade count, avg spread, order imbalance, realized volatility, step, BBO.
- **Controls** — Run/Pause, speed (1× / 4× / 16×), Reseed (new random market).

## Files
- `lib/engine.ts` — order book + matching (TS port).
- `lib/traders.ts` — agent behaviours + seeded PRNG.
- `lib/simulation.ts` — driver, candle aggregation, analytics.
- `components/CandleChart.tsx` — canvas chart.
- `app/page.tsx` — the console (RAF loop) · `app/globals.css` — the theme.

## Verified
- `npm run build` → clean, fully static (First Load JS ≈ 92 kB).
- Ran in-browser: emergent price series, populated book/tape/analytics, candles rendering.
- **Bug found & fixed during verification:** the candle array is mutated in place, so React saw a stable reference and the chart effect only ran once (0×0 canvas). Fix: pass a `version` (step count) into the chart's effect deps. Logged here because it's a good interview anecdote about React referential identity vs mutable state.

## To deploy
Follow [[Deploy-to-Vercel]] — import repo, set Root Directory to `web/console`, deploy.

## Stretch (later)
- Interactive trader-mix editor (add/remove agents live) — the `TraderConfig` plumbing already exists.
- A "manual order" panel so *you* can send an order into the live book and watch impact.
- Swap the custom canvas for TradingView `lightweight-charts` if you want their exact interactions.
