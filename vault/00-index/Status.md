# Status

**Last updated:** 2026-07-05

## Current milestone
**Milestone 2 — Financial Instruments** (🟡 in progress)
See [[Milestone-02-Financial-Instruments]].

## Done so far
- Repo scaffolded, git initialised, remote → `github.com/aryasgit/Project-Agora`.
- Vault structure created (index, concepts, decisions, guides, glossary, milestones, references).
- Stack decision **accepted** → [[ADR-0001-stack]] (FastAPI + Next.js → Vercel).
- **Milestone 1 complete** (4/5, passed). Market-order/impact mechanics locked in → [[Milestone-01-Exchange-Fundamentals]].

## Immediately next
1. Read [[Financial-Instruments]] + glossary ([[Tick-Size]], [[Lot-Size]], [[Contract-Multiplier]]).
2. Do the small `Instrument` value-object task in [[Milestone-02-Financial-Instruments]].
3. Run the Milestone 2 viva questions through ChatGPT; note anything shaky in the vault.
4. On completion → Milestone 3 (Order Types).

## Working style
- Viva/reflection questions live **in the milestone notes**, not in chat (student runs them through ChatGPT separately).
- Chat is for short status + code review; the vault is the source of truth.

## Decision log
- **2026-07-05** — Project named *Agora*. Engine/UI separation adopted. Stack = FastAPI + Next.js → Vercel (**accepted**).
- **2026-07-05** — Launch as **single synthetic instrument** (`AGORA`, tick 0.01, lot 1); multi-asset deferred to Milestone 10.
- **2026-07-05** — Prices/quantities to be stored as **integers** (ticks/lots), not floats → formal ADR-0002 due at Milestone 4.
