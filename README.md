# Project Agora

> *Agora* (ἀγορά) — the marketplace of an ancient Greek city. This project rebuilds a modern **electronic exchange** from first principles.

**Live console → https://console-ecru-omega.vercel.app**

A simplified electronic exchange and **market-microstructure research platform**. Not a trading bot and not a price predictor — a machine for *understanding how markets actually work*: an order book, a price-time-priority matching engine, a population of simulated traders, and an analytics layer. Prices are not set; they **emerge** from order flow. A TradingView-style console (strict black, red/green) visualises it live.

## Structure
```
engine/agora/   pure-Python simulation engine (no UI dependencies)
web/            FastAPI API + Next.js console (deploys to Vercel)
tests/          pytest — engine-first
vault/          the full knowledge base: concepts, decisions, guides, glossary, milestones
```

## The vault
Everything — every concept, decision, term, and milestone — is documented in `vault/`, an Obsidian-compatible knowledge base. Start at [`vault/00-index/Home.md`](vault/00-index/Home.md).

## Run it

**Engine + tests (Python):**
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest                                   # 21 tests, engine-first
cd engine && python -m agora.simulation  # ~1000 emergent trades + analytics
```

**Live console (Next.js):**
```bash
cd web/console
npm install
npm run dev        # http://localhost:3737
```
Deploy: import the repo on Vercel with Root Directory `web/console` (see [`vault/30-guides/Deploy-to-Vercel.md`](vault/30-guides/Deploy-to-Vercel.md)).

## Status
Milestones 1–9 built: full engine (price-time-priority matching, traders, analytics, 21 passing tests) and a live TradingView-style console. Deploy + study pass remaining. See [`vault/00-index/Roadmap.md`](vault/00-index/Roadmap.md).

## Stack
Python engine (tested reference) · Next.js console with a client-side TS engine port · Vercel. Rationale in [`vault/20-decisions/ADR-0001-stack.md`](vault/20-decisions/ADR-0001-stack.md) and [`ADR-0003`](vault/20-decisions/ADR-0003-console-runtime.md).
