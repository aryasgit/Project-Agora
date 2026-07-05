# Passive vs Aggressive

The single most useful lens on order flow.

- **Passive (liquidity-providing):** a resting order that waits in the book to be traded against. A limit order priced *away* from the current market. You **add** [[Liquidity]]. Market makers live here.
- **Aggressive (liquidity-taking):** an order that **crosses the spread** and executes immediately against resting orders. A market order, or a limit order priced through the [[Bid-Ask-Spread]]. You **remove** liquidity.

Every trade is a taker hitting a maker. This distinction drives:
- **Order types** (Milestone 3): limit = usually passive, market = always aggressive.
- **The book** (Milestone 4): passive orders are *what the book stores*.
- **Matching** (Milestone 5): aggressive orders trigger the match; price-time priority decides which passive order fills first.

Related: [[Market-Maker]], [[Price-Discovery]].
