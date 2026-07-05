# Milestone 1 — Exchange Fundamentals

**Status:** 🟡 In progress · **No code this milestone** — this is a mental-model milestone. You cannot design a good order book until you can explain, in your own words, what an exchange *does* and who uses it.

## Learning objectives
By the end you can, without notes:
- List the market participants and say what each *wants*.
- Explain the difference between **providing** and **taking** liquidity.
- Explain how a price **emerges** from participant interaction (no central price-setter).
- Explain what an exchange is responsible for vs what it deliberately does *not* do.

## Concepts to study
Read [[Market-Participants]] first (in `10-concepts/`). Then make sure these glossary terms are clear:
[[Liquidity]] · [[Bid-Ask-Spread]] · [[Market-Maker]] · [[Price-Discovery]] · [[Market-Impact]] · [[Passive-vs-Aggressive]].

## Design discussion (think about, don't code yet)
- If the exchange never owns the asset and never sets the price, **what is the one job it must do perfectly?** (Hint: fairness of *who trades first*.)
- A market maker profits from the spread but risks inventory. **What would make them widen their spread?** (This foreshadows spread-widening in Milestone 7.)
- Retail orders are small and mostly aggressive; institutional orders are large. **Why can't an institution just send one giant market order?** (Market impact — Milestone 7.)

## Tasks
1. Read [[Market-Participants]] end to end.
2. In your own words (a paragraph each), write into this vault under `10-concepts/` or as answers below:
   - What an exchange is responsible for.
   - The passive-vs-aggressive distinction with your own example.
3. Confirm or push back on [[ADR-0001-stack]] (the FastAPI + Next.js decision).

## Reflection questions (answer these to unlock Milestone 2)
1. A market maker is quoting **bid 50.00 / ask 50.10**. A retail trader sends a **market buy** for 1 unit. **At what price does it execute, and why that side?**
2. After that trade, is the market maker now long or short one unit? What might they do to their quotes next, and why?
3. Two buyers both want to buy at exactly 50.00. Only one seller shows up willing to sell 1 unit at 50.00. **Who should get the trade, and on what principle?** (You're inventing price-time priority — Milestone 5.)
4. Explain in two sentences why the "price of the stock" can change **without any news** — purely from order flow.
5. Why do we insist the simulation engine has *no dependency on the web UI*? Give one concrete benefit.

## Stretch goals
- Watch a real Level-2 order book (any broker's depth-of-market view) for 5 minutes and write 3 observations into the vault.
- Sketch (on paper) the data you think an order book must store per resting order. Keep the sketch — we'll compare it to your Milestone 4 design.

---
### My answers
> _(write your reflection answers here, then tell the mentor)_
