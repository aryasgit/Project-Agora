# Contract Multiplier

For derivatives (futures, options), the **quantity of underlying that one contract represents.** E.g. 1 oil future = 1,000 barrels (multiplier 1,000); 1 equity option = 100 shares (multiplier 100).

Why it exists: it lets one tradeable "contract" stand for a standardised chunk of the underlying, so contracts are fungible and the book stays clean.

Relevance to Agora: **none for the core engine** — a stock has multiplier 1. It only matters if/when we add futures or options (Milestone 10). Noted here so the vocabulary is complete. Reinforces the core lesson: the matching engine is instrument-agnostic; the multiplier is *metadata on the contract*, not part of matching.

Related: [[Financial-Instruments]], [[Tick-Size]], [[Lot-Size]].
