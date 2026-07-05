# Market Maker (MM)

A participant who **continuously posts both a bid and an ask**, standing ready to trade either side. Profits from the [[Bid-Ask-Spread]]: buy at the bid, sell at the ask, pocket the difference — repeatedly.

- Provides [[Liquidity]] (their orders rest in the book for others to hit → passive; see [[Passive-vs-Aggressive]]).
- Core risk = **inventory risk**: after trading they hold a position; if the market moves against it, they lose. They manage this by **skewing/widening quotes**.
- In Agora, a `MarketMaker` agent (Milestone 6) posts two-sided quotes around a reference price and re-quotes as it accumulates inventory.

"Liquidity provider" is used interchangeably here.
