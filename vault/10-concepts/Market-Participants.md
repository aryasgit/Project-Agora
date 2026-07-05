# Market Participants — Who's in the Room

A market is just a set of people (and machines) who want to trade, plus the infrastructure that lets them. Before any code, you need a clear mental model of **who acts, what they want, and how their wants collide to produce a price.**

## The core roles

### 1. Buyers and sellers (the demand and supply)
Everyone in a market is ultimately trying to either **buy** (acquire an asset) or **sell** (dispose of one). A trade happens only when a buyer and a seller agree on a price. That agreement is the atom of everything else. Nobody "sets" the price centrally — it is the price at which a willing buyer and a willing seller meet.

### 2. The exchange
The **exchange** is the neutral venue and rulebook. It does **not** take a position (it doesn't want to own the asset). Its job:
- Receive orders from participants.
- Maintain the **order book** (the list of everyone's current buy/sell interest).
- Run the **matching engine** (decide who trades with whom, and in what order).
- Publish the results (trades and quotes) back to everyone — the *market data*.

Agora *is* this exchange. That's the thing we're building.

### 3. Brokers
Most participants can't plug directly into an exchange. A **broker** is the intermediary that (a) holds your account, (b) forwards your orders to the exchange, and (c) handles settlement and compliance. For our simulator, brokers are mostly abstracted away — but know that in reality your order passes broker → exchange, not you → exchange.

### 4. Market makers / liquidity providers
A **market maker (MM)** continuously posts *both* a buy price (bid) and a sell price (ask), and profits from the **spread** (the gap between them). They are the shopkeepers of the market: always willing to trade, so you never have to wait for a matching counterparty. They provide **liquidity** — the ability to trade immediately without moving the price much. Their risk is **inventory**: if the market moves against the stock they're holding, they lose. They manage this by adjusting their quotes.

> Liquidity provider ≈ market maker for our purposes. Both *post resting orders that others can hit.* They are the "passive" side.

### 5. Liquidity takers (retail & institutional traders)
- **Retail traders**: individuals with small orders. Usually **take** liquidity (they hit existing quotes) rather than provide it. Individually tiny, collectively large.
- **Institutional traders**: funds, banks, pensions with **large** orders. A big institutional order can't be filled at one price without moving the market (**market impact**) — so they slice it up over time. Studying this slicing is a core microstructure topic (Milestone 7).

## Passive vs aggressive — the single most important distinction
Forget the labels for a second. Every order is one of two things:
- **Passive / providing:** a resting order that *waits* in the book for someone to trade against it (a limit order away from the current price). You *add* liquidity.
- **Aggressive / taking:** an order that *crosses* the spread and executes immediately against resting orders (a market order, or a marketable limit). You *remove* liquidity.

Market makers are usually passive. A retail "buy now" click is aggressive. **The whole market is a dance between people who post and people who hit.** Hold onto this — it explains order types (Module 3), the book (Module 4), and matching (Module 5).

## How they interact — one concrete loop
1. A market maker posts: willing to **buy at 100.00** (bid) and **sell at 100.05** (ask). Spread = 0.05.
2. A retail trader wants in *now* and sends a **market buy**. It executes against the MM's ask at **100.05**. The MM is now short one unit; the retail trader owns one unit.
3. The MM, now holding less inventory, might nudge its quotes up to 100.01 / 100.06 to rebalance.
4. An institution quietly posts a large passive **buy at 100.02**, tightening the bid.
5. The **best bid** is now 100.02, **best ask** 100.06 → the *price* everyone sees has moved, purely from these interactions. **Nobody decreed it.**

That emergent, no-central-authority price is what Agora exists to let you observe.

## Why this matters for the build
- The **order book** must represent both sides (bids/asks) and preserve *who was first* → Module 4.
- The **matching engine** must decide priority fairly → Module 5 (price-time priority).
- The **simulated traders** in Module 6 are literally software versions of the roles above — a `MarketMaker` agent posts two-sided quotes, a `MomentumTrader` takes liquidity when price trends, etc.

See also: [[Liquidity]], [[Bid-Ask-Spread]], [[Price-Discovery]] (glossary), and the milestone note [[Milestone-01-Exchange-Fundamentals]].
