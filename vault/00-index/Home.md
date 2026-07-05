# Project Agora — Home

> *Agora* (ἀγορά): the central public marketplace of an ancient Greek city — where people met to trade and exchange information. This project rebuilds a modern electronic version of that marketplace from first principles.

## What this is
A simplified **electronic exchange and market-microstructure research platform**. Not a trading bot, not a price predictor. The goal is to *understand how markets actually work* by building the machinery that makes them run: an order book, a matching engine, simulated traders, and an analytics layer — then watching prices emerge from their interactions.

## What "done" looks like
- A matching engine enforcing **price-time priority** with full/partial fills, cancels, and modifies.
- A limit order book with bids, asks, depth, and best-bid/best-ask.
- A population of simulated traders whose interaction *produces* a price series (nobody sets the price — it emerges).
- An analytics layer (VWAP, spread, order imbalance, depth, volatility).
- A deployed **TradingView-style console** (strict black background, red/green) on Vercel.

## How to navigate this vault
- **[[Roadmap]]** — the 10 milestones and current status.
- **[[Status]]** — where we are right now, what's next.
- `10-concepts/` — the finance & microstructure ideas, explained plainly.
- `20-decisions/` — architecture decision records (ADRs): *why* we chose each thing.
- `30-guides/` — how-to guides (running the engine, deploying, testing).
- `40-glossary/` — every term, defined in one place. Start here when a word confuses you.
- `50-milestones/` — one note per milestone: objectives, tasks, reflections.
- `90-references/` — books, papers, docs, videos.

## Mentorship contract
This is built **with a mentor, not by one**. The mentor explains concepts, reviews code, and challenges design — but does **not** hand over complete implementations. Every milestone ends with reflection questions that must be answered before moving on.
