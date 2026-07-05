# Milestone 2 — Financial Instruments

**Status:** 🟡 In progress · **Minimal code** — one small data class at the end. This milestone is mostly vocabulary + two design decisions (tick/lot) that will constrain Milestone 4.

## Learning objectives
- Name the main instrument types (stock, ETF, future, option) and what each represents.
- State the one unifying idea: **the matching engine is instrument-agnostic.**
- Explain **tick size** and **lot size**, and why they force **integer** storage of price and quantity.

## Concepts to study
Read [[Financial-Instruments]]. Glossary: [[Tick-Size]], [[Lot-Size]], [[Contract-Multiplier]].

## Recommended resources
- Larry Harris, *Trading and Exchanges* — the instruments chapter (skim; you only need the trading mechanics, not valuation).
- Investopedia entries for "tick size" and "board lot" for concrete real-world examples across exchanges.

## Design discussion
1. **Why integers, not floats, for price and quantity?** Float `0.1 + 0.2 != 0.3`. If price is a *dict key* in your book, `50.01` computed two different ways may not compare equal → orders silently land in the wrong bucket. Storing price as **ticks (int)** and quantity as **lots/units (int)** makes equality exact and matching deterministic. This becomes ADR-0002 at Milestone 4 — start forming the argument now.
2. **What's the minimum an `Instrument` needs?** Ticker, tick size, lot size. That's nearly it for the core. Everything else (multiplier, expiry, strike) is derivative-only metadata we defer.
3. **Single instrument first.** Agora launches with one synthetic stock, one book. Multi-asset is Milestone 10. Resist the urge to generalise early.

## Tasks
1. Read [[Financial-Instruments]] and the three glossary notes.
2. Decide Agora's launch instrument parameters and record them here (proposed: ticker `AGORA`, tick_size `0.01`, lot_size `1`).
3. **Small code task** — in `engine/agora/`, create an `Instrument` value object. Suggested shape (frozen dataclass): fields `symbol: str`, `tick_size` and `lot_size` represented so that prices/quantities are handled as integers of ticks/lots. Do **not** add expiry/strike — keep it to what the core engine needs. Write one test asserting a price like `50.005` is rejected/snapped as off-grid.
   - *Snippet scope only — mentor will review your version, not hand you the file.*

## Viva / reflection questions (answer these in your ChatGPT viva)
1. An ETF and a stock hit the same exchange. Does the matching engine treat them differently? Justify in one sentence.
2. Tick size is 0.05. Are 50.00, 50.05, 50.07, 50.10 all valid prices? Which isn't, and why does the exchange forbid it?
3. Why is storing price as a **float** a latent bug in an order book? Give the failure mode in terms of dict keys / equality.
4. What is the *tightest possible spread* on an instrument with tick size 0.01, and why can't it be tighter?
5. A future and an option both "trade on an exchange" — name the one thing that makes them fundamentally different from a stock (hint: two words, one expires, one is a right-not-obligation).
6. Why does Agora deliberately launch with a single instrument instead of a generic multi-asset engine on day one? (Engineering answer, not finance.)
7. Contract multiplier for an equity option is 100. If you "buy 3 contracts," how many shares of exposure is that, and why doesn't the matching engine need to know this number to match your order?

## Stretch goals
- Look up the actual tick-size regimes on a real exchange (many use *tiered* ticks — smaller ticks for cheap stocks, larger for expensive ones). Write 2 lines on why tiered ticks exist.
- Sketch how you'd extend `Instrument` to a future without touching the matching engine. If you can't, the engine isn't asset-agnostic enough — note where the coupling is.

---
### Notes / answers
> _(record decisions and any working here)_
