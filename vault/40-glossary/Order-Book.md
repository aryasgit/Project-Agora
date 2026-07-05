# Order Book

The exchange's live ledger of all resting (unmatched) orders, split into two sides:
- **Bid side** — buy orders, sorted highest-price-first. Top = **best bid**.
- **Ask side** — sell orders, sorted lowest-price-first. Top = **best ask**.

Each **price level** holds a FIFO queue of orders at that price. **Market depth** = how much volume rests at each level. The gap between best bid and best ask is the [[Bid-Ask-Spread]].

Agora's implementation (`engine/agora/book.py`): a `SortedDict[int_ticks, PriceLevel]` per side (bids stored under negated keys so the best bid is first), each `PriceLevel` a `deque` of orders. This gives O(1) best-of-book access and O(log n) level maintenance, and directly encodes [[Price-Time-Priority]]. See [[Engine-Architecture]].
