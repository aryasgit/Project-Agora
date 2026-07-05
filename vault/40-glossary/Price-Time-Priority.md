# Price-Time Priority

The matching rule almost every modern exchange uses:
1. **Price first** — the best-priced resting order fills first (highest bid / lowest ask).
2. **Time second** — among orders at the *same* price, the one that arrived earliest fills first.

In Agora this is encoded structurally (see [[Order-Book]]): price priority = the SortedDict ordering of levels; time priority = the FIFO `deque` inside each level. An incoming aggressive order walks the best opposite level, filling the front of the queue first.

Consequence: **`modify` (cancel-replace) loses time priority** — changing your order sends it to the back of the queue at its new price. This is why quoting is a careful game. Related: [[Passive-vs-Aggressive]], [[Market-Impact]].
