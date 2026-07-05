# Lot Size

The **smallest allowed quantity increment** (and often a minimum order size). Lot 1 → trade whole units; some markets force lots of 100. Every order quantity must be an integer multiple of the lot.

Consequences for Agora:
- Quantities are discrete → **store as integers, never floats.** "0.5 units filled" is impossible by construction.
- **Partial fills** (Milestone 5) still land on the lot grid: fill 3 of 8, never 3.5.

Related: [[Tick-Size]], [[Financial-Instruments]].
