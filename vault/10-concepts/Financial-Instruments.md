# Financial Instruments — What Actually Gets Traded

An **instrument** is any standardised, tradeable contract. Agora's engine doesn't care *what* the instrument is — an order book for apples works the same as one for Apple shares. But you need the vocabulary, because (a) interviewers assume it, and (b) two properties — **tick size** and **lot size** — directly constrain the data structures you'll build in Milestone 4.

Only enough theory to run the simulator. No pricing math yet.

## The instrument types

### Stocks (equities)
A share of ownership in a company. The canonical order-book instrument. If you own 1 share of a company with 1,000,000 shares, you own one-millionth of it. Prices move on supply/demand for that ownership. **Agora ships with a single synthetic stock first** (e.g. ticker `AGORA`) — one instrument, one book. Everything else is a Milestone 10 extension.

### ETFs (Exchange-Traded Funds)
A single tradeable instrument that *holds a basket* of other assets (e.g. "all 500 big US companies"). Trades on an exchange **exactly like a stock** — same order book, same matching. For our engine, an ETF is indistinguishable from a stock; the difference is what it represents, not how it trades. Good mental note: *the matching engine is asset-agnostic.*

### Futures
A **contract** to buy/sell something at a **fixed price on a fixed future date**. Standardised by the exchange (quantity, quality, expiry all fixed) so they're fungible and tradeable. Key properties that differ from stocks:
- They **expire**.
- They're **leveraged** (you post a small margin, control a large notional).
- One contract represents a fixed quantity of the underlying (the **contract/lot size**), e.g. 1 oil future = 1,000 barrels.
You won't build futures mechanics now, but understand: *a future is still just an instrument with a book and a matching engine behind it.*

### Options
A **contract giving the right, but not the obligation**, to buy (**call**) or sell (**put**) an underlying at a set **strike price** before/at expiry. You pay a **premium** for that right. Options are where the quant math lives (Black-Scholes, Greeks) — and notably, that's what your *other* project (`quant-trading-platform`) already covers. In Agora, options are a **Milestone 10 stretch**, and even then they still trade through the same order book. The insight repeats: *the exchange machinery is the same; only the contract definition changes.*

### Contracts (the general idea)
Futures and options are both **derivative contracts** — their value *derives* from some underlying asset. Stocks/ETFs are the underlying "cash" instruments. For Agora's core, we trade a cash instrument (a stock). The word "contract" also just means "one unit of a derivative" (as in "I bought 5 contracts").

## The two properties that shape your code

### Tick size — the price grid
The **smallest allowed price increment.** If tick size is 0.01, valid prices are 50.00, 50.01, 50.02 … but **never 50.005**. The exchange quantises price to a grid.

Why you care (Milestone 4):
- Prices become a **discrete, countable set**, not continuous reals. That's what lets you use a price → order-queue map (dict / sorted structure) as the book. You can bucket orders by exact price level because there are finitely many valid prices.
- It bounds the [[Bid-Ask-Spread]]: the tightest possible spread is exactly **one tick**.
- **Design consequence:** store prices as **integers in ticks** (e.g. 5001 = $50.01), not floats. Floating-point equality (`50.01 == 50.01`) is unsafe for the price *keys* your book is indexed by. This is a real, interview-worthy decision — write it down when you hit Milestone 4.

### Lot size — the quantity grid
The **smallest allowed quantity increment** (and often a minimum). If lot size is 1, you trade whole units; some markets force lots of 100. Orders must be an integer multiple of the lot.

Why you care:
- Quantities are also **discrete** → store them as **integers**, never floats. "0.5 shares filled" should be impossible by construction.
- **Partial fills** (Milestone 5) still land on the lot grid — you can fill 3 of 8 units, but not 3.5.

## The one idea to carry forward
> **The matching engine is instrument-agnostic. Stock, ETF, future, option — same book, same price-time priority. What changes is the contract's *definition* (expiry, strike, multiplier), not the *mechanics* of matching.**

This is why we build one clean engine now and treat multi-asset/options as extensions later. It also means: **tick size and lot size are the only instrument properties the core engine truly needs.** Everything else is metadata.

See also: [[Tick-Size]], [[Lot-Size]], [[Contract-Multiplier]] (glossary), and [[Milestone-02-Financial-Instruments]].
