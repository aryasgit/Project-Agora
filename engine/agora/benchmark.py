"""Throughput benchmark — how many orders/sec the matching engine sustains.

Fires a realistic mix of limit/market/cancel operations at a warmed-up book and
reports orders/sec and trades/sec, single-threaded, pure Python.

    python -m agora.benchmark            # default 200k orders
    python -m agora.benchmark 1000000    # 1M orders
"""
from __future__ import annotations

import random
import sys
import time

from .engine import MatchingEngine
from .instrument import Instrument
from .orders import Order, OrderType, Side, TimeInForce


def run(n_orders: int = 200_000, seed: int = 1) -> dict:
    rng = random.Random(seed)
    eng = MatchingEngine(Instrument("BENCH"))

    # warm the book so there is standing liquidity to match against
    mid = 10_000
    for i in range(1, 200):
        eng.submit(Order(id=eng.next_id(), side=Side.BUY, type=OrderType.LIMIT,
                         quantity=rng.randint(1, 50), price=mid - i))
        eng.submit(Order(id=eng.next_id(), side=Side.SELL, type=OrderType.LIMIT,
                         quantity=rng.randint(1, 50), price=mid + i))

    resting: list[int] = []
    trades_before = len(eng.trades)

    start = time.perf_counter()
    for _ in range(n_orders):
        roll = rng.random()
        side = Side.BUY if rng.random() < 0.5 else Side.SELL
        ref = eng.last_price or mid
        if roll < 0.15:  # market order — takes liquidity
            eng.submit(Order(id=eng.next_id(), side=side, type=OrderType.MARKET,
                             quantity=rng.randint(1, 20)))
        elif roll < 0.25 and resting:  # cancel a resting order
            eng.cancel(resting.pop(rng.randrange(len(resting))))
        else:  # limit order near the touch — mostly adds liquidity
            off = rng.randint(1, 8)
            price = ref - off if side is Side.BUY else ref + off
            o = Order(id=eng.next_id(), side=side, type=OrderType.LIMIT,
                      quantity=rng.randint(1, 20), price=price)
            eng.submit(o)
            if eng.book.contains(o.id):
                resting.append(o.id)
    elapsed = time.perf_counter() - start

    trades = len(eng.trades) - trades_before
    return {
        "orders": n_orders,
        "seconds": elapsed,
        "orders_per_sec": n_orders / elapsed,
        "trades": trades,
        "trades_per_sec": trades / elapsed if elapsed else 0.0,
    }


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200_000
    r = run(n)
    print("Agora matching-engine throughput (single-threaded, pure Python)")
    print(f"  orders submitted : {r['orders']:,}")
    print(f"  wall time        : {r['seconds']:.3f} s")
    print(f"  throughput       : {r['orders_per_sec']:,.0f} orders/sec")
    print(f"  trades matched   : {r['trades']:,} ({r['trades_per_sec']:,.0f} trades/sec)")


if __name__ == "__main__":
    main()
