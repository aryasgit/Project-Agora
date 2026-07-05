# Status

**Last updated:** 2026-07-05

## Current milestone
**Build phase complete — Milestones 1–9 built.** Remaining: your Vercel import (deploy) + study/viva pass over the vault.

## Done so far
- Repo scaffolded, git initialised, remote → `github.com/aryasgit/Project-Agora`.
- Full vault (index, concepts, decisions, guides, glossary, milestones, references).
- **Engine (Modules 2–8)** in `engine/agora/`: instrument, orders, order book, matching engine (price-time priority, partial fills, cancel/modify, stops), traders, analytics, simulation — **21 pytest tests passing**. See [[Engine-Architecture]].
- **Console (Module 9)** in `web/console/`: live TradingView-style UI, verified in-browser, clean static build. See [[Milestone-09-Console]].
- Decisions accepted: [[ADR-0001-stack]], ADR-0002 (integer ticks), [[ADR-0003-console-runtime]].

## Immediately next
1. **Deploy:** follow [[Deploy-to-Vercel]] (import repo, Root Directory = `web/console`).
2. **Study:** work through the milestone notes + glossary as your source; run the viva questions in each milestone note through ChatGPT.
3. Optional extensions (Milestone 10): manual-order panel, live trader-mix editor, multi-asset.

## Working style
- Viva/reflection questions live **in the milestone notes**, not in chat (student runs them through ChatGPT separately).
- Chat is for short status + code review; the vault is the source of truth.

## Decision log
- **2026-07-05** — Project named *Agora*. Engine/UI separation adopted. Stack = FastAPI + Next.js → Vercel (**accepted**).
- **2026-07-05** — Launch as **single synthetic instrument** (`AGORA`, tick 0.01, lot 1); multi-asset deferred to Milestone 10.
- **2026-07-05** — Prices/quantities to be stored as **integers** (ticks/lots), not floats → formal ADR-0002 due at Milestone 4.
