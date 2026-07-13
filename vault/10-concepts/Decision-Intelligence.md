# Decision Intelligence — What Agora Is *For*

Agora is not a simulator you watch. It is a **decision-intelligence system for markets**: a tool that reduces the cost of experimentation by letting you answer *"what happens if I do X?"* **before** committing to X.

A backtester asks "did this signal make money on the past?" Agora asks the deeper, forward question: **"what does this intervention do to the market, and should I do it?"**

## Every session should answer four questions

### 1. What is happening?
The state, made legible — not just numbers. The **depth map** (liquidity as a substance), the **order book**, the **tape**, the **analytics** (spread, imbalance, volatility). You can *see* the market, not just read metrics off it.

### 2. Why did it happen?
A **causal chain**, not a black box. The Scenario Lab's decision report explains, e.g.:
> Market makers removed → resting quotes vanish → spread widens 57% → the same order flow moves price further → volatility rises 218%.
Every sentence is derived from a *measured* delta, not scripted.

### 3. What happens if I intervene?
The core interaction: **fork reality.** Build a CONTROL market and a TREATMENT market from an identical seed and base state, apply one intervention to the treatment (pull the market makers, inject a 400-lot sweep, unleash a momentum crowd…), run both forward, and compare timelines. Because they start identical and share the RNG, the divergence is **caused** by the intervention.

### 4. Should I actually do it?
A **decision report**: verdict, causal chain, a measured-effect table (Δ per metric), trade-offs, and a **confidence** grounded in repetition — the experiment runs across 8 independent seeds, and confidence reflects how often the direction held (e.g. "spread widened in 7/8 seeds → High"). Not one lucky run.

## Why this framing matters for the interview
It reframes the whole project from "I built a cool simulator" to "I built a tool that produces *decisions* under uncertainty." The Scenario Lab is a controlled experiment with a control group, an intervention, replication, and a confidence measure — the scientific method applied to market structure. That is exactly the mindset quant research runs on.

## Market interventions ≠ business interventions
The generic decision-intelligence framing lists business moves (hire, acquire, expand to Japan). Agora's domain is **markets**, so its interventions are market-native: pull liquidity, add makers, inject a large order, add a persistent seller, unleash momentum. Same philosophy, correct domain.

## What's built vs. what the framing implies next
- **Built:** Scenario Lab (fork → run → decision report), multi-seed confidence, causal narrative, decision journal (persisted), the interventions above.
- **Natural next steps (not yet built):** hover-to-explain on every live metric ("why is the spread this wide *right now*"); a scenario library of saved experiments; branch trees (compare 3+ interventions at once); expected-vs-actual tracking in the journal.

See also: [[Queue-Position-and-Latency]], [[Price-Discovery]], [[Market-Impact]], [[Engine-Architecture]].
