# Project Agora

> *Agora* (ἀγορά) — the marketplace of an ancient Greek city. This project rebuilds a modern **electronic exchange** from first principles.

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

## Status
Milestone 1 (Exchange Fundamentals) in progress. See [`vault/00-index/Roadmap.md`](vault/00-index/Roadmap.md).

## Stack
Python engine · FastAPI · Next.js · Vercel. Rationale in [`vault/20-decisions/ADR-0001-stack.md`](vault/20-decisions/ADR-0001-stack.md).
