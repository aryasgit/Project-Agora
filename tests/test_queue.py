"""Queue position — the microstructure primitive behind fill probability."""
import pytest

from agora import Instrument, MatchingEngine, Order, OrderType, Side, TimeInForce


@pytest.fixture
def eng():
    return MatchingEngine(Instrument("AGORA"))


def limit(eng, side, price, qty, tid=None):
    return Order(id=eng.next_id(), side=side, type=OrderType.LIMIT,
                 quantity=qty, price=price, trader_id=tid)


def market(eng, side, qty):
    return Order(id=eng.next_id(), side=side, type=OrderType.MARKET, quantity=qty)


def test_queue_position_reflects_fifo(eng):
    a = limit(eng, Side.BUY, 5000, 10, "A")
    b = limit(eng, Side.BUY, 5000, 5, "B")
    c = limit(eng, Side.BUY, 5000, 7, "C")
    for o in (a, b, c):
        eng.submit(o)

    qa = eng.book.queue_position(a.id)
    qc = eng.book.queue_position(c.id)
    assert qa.rank == 1 and qa.orders_ahead == 0 and qa.volume_ahead == 0
    assert qa.total_orders == 3
    # C is last: 2 orders and 15 lots ahead of it
    assert qc.rank == 3
    assert qc.orders_ahead == 2
    assert qc.volume_ahead == 15
    assert qc.orders_behind == 0


def test_queue_position_updates_after_front_fills(eng):
    a = limit(eng, Side.BUY, 5000, 10, "A")
    b = limit(eng, Side.BUY, 5000, 5, "B")
    eng.submit(a)
    eng.submit(b)
    # a sell eats all of A (front) — B advances to the front
    eng.submit(market(eng, Side.SELL, 10))
    qb = eng.book.queue_position(b.id)
    assert qb.rank == 1
    assert qb.volume_ahead == 0
    assert qb.own_remaining == 5


def test_queue_position_partial_fill_of_the_order_ahead(eng):
    a = limit(eng, Side.BUY, 5000, 10, "A")
    b = limit(eng, Side.BUY, 5000, 5, "B")
    eng.submit(a)
    eng.submit(b)
    # sell 4 — only part of A fills; B still behind A's remaining 6
    eng.submit(market(eng, Side.SELL, 4))
    qb = eng.book.queue_position(b.id)
    assert qb.rank == 2
    assert qb.volume_ahead == 6  # A had 10, 4 filled


def test_queue_position_none_when_not_resting(eng):
    assert eng.book.queue_position(999) is None
    o = limit(eng, Side.BUY, 5000, 5)
    eng.submit(o)
    eng.cancel(o.id)
    assert eng.book.queue_position(o.id) is None


def test_lower_latency_reaches_book_first(eng):
    """In the simulation, orders are submitted in latency order — verify the
    engine honours whatever arrival order it is given (time priority)."""
    fast = Order(id=eng.next_id(), side=Side.BUY, type=OrderType.LIMIT,
                 quantity=5, price=5000, trader_id="FAST", latency=5)
    slow = Order(id=eng.next_id(), side=Side.BUY, type=OrderType.LIMIT,
                 quantity=5, price=5000, trader_id="SLOW", latency=200)
    # submit in arrival order (fast first, as the simulation would)
    for o in sorted([fast, slow], key=lambda o: o.latency):
        eng.submit(o)
    trades = eng.submit(market(eng, Side.SELL, 5))
    assert trades[0].maker_trader_id == "FAST"  # fast got the front of the queue
