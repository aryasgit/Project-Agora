# Queue Position & Latency — the Heart of Market Making

This is the most microstructure-authentic idea in Agora, and the one a matching-engine or market-making interviewer will press hardest on. Understand it cold.

## The setup
At a single price level, resting orders sit in a **FIFO queue** — first in, first out ([[Price-Time-Priority]]). When an aggressive order arrives and trades at that price, it fills the **front** of the queue first. So your **fill probability is governed by how much volume sits *ahead* of you**, not by how much is at the price in total.

If there are 10,000 lots resting at 50.00 and you join the back, you don't trade until ~10,000 lots have traded through — and by then the market has often moved, meaning you only fill when you *didn't* want to (you get filled on the way to a worse price). That's **adverse selection**, and it's why queue position is worth real money.

## Where latency comes in
Two orders want the same spot in the queue. The one that **reaches the matching engine first** gets it. Reaching first is a technology problem: colocation, faster networks, tighter code — i.e. **lower latency**. So the race for the front of the queue *is* the latency race that HFT firms spend fortunes on.

In Agora:
- Every order carries a `latency`. Agents have profiles: market makers are fastest (`latency=10`, colocated), momentum/institutional mid, noise/passive slowest (`90–120`).
- Each simulation step, all orders generated that step are submitted in **arrival order** = `latency + jitter`. Faster agents reach the book first and claim better queue spots.
- Your manual orders have `latency = 0` (a click reaches the book immediately) — but existing resting orders are already ahead of you by time priority.

## What the engine exposes
`OrderBook.queue_position(order_id)` → a `QueuePosition`:
- `rank` (1 = front, next to fill), `total_orders` at the level
- `orders_ahead`, **`volume_ahead`** (the number that matters), `orders_behind`, `volume_behind`
- `own_remaining`

O(k) in the orders at that one price level. The console shows this live for your resting order: *lots ahead · yours · behind*, updating as the queue drains.

## Interview soundbite
> *"Fill probability is a queue problem, not a price problem. At a level it's strict FIFO, so what matters is the volume ahead of you — and the only way to be ahead is to arrive earlier, which is a latency race. My engine models per-order latency, arrives orders in latency order, and exposes queue position (lots ahead / rank) so you can watch where you sit and reason about adverse selection."*

## Why it's not overbuilt
It reuses the existing FIFO `deque` per level — `queue_position` is just introspection over structure that was already there for matching. Latency is one field plus an arrival sort in the simulation. Small code, high signal.

See also: [[Price-Time-Priority]], [[Order-Book]], [[Market-Maker]], [[Engine-Architecture]].
