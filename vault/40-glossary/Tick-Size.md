# Tick Size

The **smallest allowed price increment** for an instrument. Tick 0.01 → valid prices are 50.00, 50.01, … but never 50.005. Price lives on a discrete grid, not a continuous line.

Consequences for Agora:
- The tightest possible [[Bid-Ask-Spread]] is exactly **one tick**.
- Prices are a finite, countable set → you can index the [[Order-Book]] by exact price level.
- **Store prices as integers in ticks** (5001 ≡ $50.01), never floats — float equality is unsafe for the keys the book is indexed by. (ADR to be written at Milestone 4.)

Related: [[Lot-Size]], [[Financial-Instruments]].
