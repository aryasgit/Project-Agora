"""Matching-engine correctness — the interview-defensible core."""
import pytest

from agora import Instrument, MatchingEngine, Order, OrderType, Side, TimeInForce


@pytest.fixture
def eng():
    return MatchingEngine(Instrument("AGORA"))


def limit(eng, side, price, qty, tif=TimeInForce.GTC, tid=None):
    return Order(id=eng.next_id(), side=side, type=OrderType.LIMIT,
                 quantity=qty, price=price, tif=tif, trader_id=tid)


def market(eng, side, qty, tif=TimeInForce.GTC):
    return Order(id=eng.next_id(), side=side, type=OrderType.MARKET,
                 quantity=qty, tif=tif)


# --- resting & best-of-book ---------------------------------------------
def test_limit_orders_rest(eng):
    eng.submit(limit(eng, Side.BUY, 5000, 10))
    eng.submit(limit(eng, Side.SELL, 5010, 8))
    assert eng.book.best_bid() == 5000
    assert eng.book.best_ask() == 5010
    assert eng.book.spread() == 10


# --- the Milestone-1 market-impact example ------------------------------
def test_market_buy_walks_the_book(eng):
    eng.submit(limit(eng, Side.SELL, 5010, 5))
    eng.submit(limit(eng, Side.SELL, 5020, 10))
    trades = eng.submit(market(eng, Side.BUY, 8))
    assert [(t.price, t.quantity) for t in trades] == [(5010, 5), (5020, 3)]
    # average price 50.1375 -> in ticks weighted: (5*5010 + 3*5020)/8
    assert sum(t.price * t.quantity for t in trades) == 5 * 5010 + 3 * 5020
    assert eng.book.best_ask() == 5020
    assert eng.book.best_ask_level().volume == 7  # 10 - 3 remaining


def test_aggressive_pays_full_opposite_side(eng):
    eng.submit(limit(eng, Side.SELL, 5010, 1))
    trades = eng.submit(market(eng, Side.BUY, 1))
    assert trades[0].price == 5010  # never the mid (5005)


# --- price-time priority -------------------------------------------------
def test_time_priority_at_equal_price(eng):
    first = limit(eng, Side.BUY, 5000, 5, tid="early")
    second = limit(eng, Side.BUY, 5000, 5, tid="late")
    eng.submit(first)
    eng.submit(second)
    trades = eng.submit(market(eng, Side.SELL, 5))
    assert trades[0].maker_trader_id == "early"  # earlier order fills first


def test_price_priority(eng):
    eng.submit(limit(eng, Side.BUY, 5000, 5, tid="low"))
    eng.submit(limit(eng, Side.BUY, 5005, 5, tid="high"))
    trades = eng.submit(market(eng, Side.SELL, 5))
    assert trades[0].maker_trader_id == "high"  # best (highest) bid fills first


# --- partial fills -------------------------------------------------------
def test_partial_fill_rests_remainder(eng):
    eng.submit(limit(eng, Side.SELL, 5010, 3))
    trades = eng.submit(limit(eng, Side.BUY, 5010, 10))
    assert sum(t.quantity for t in trades) == 3
    assert eng.book.best_bid() == 5010          # remaining 7 rests as a bid
    assert eng.book.best_bid_level().volume == 7


# --- crossing limit executes, doesn't rest above ------------------------
def test_marketable_limit_executes(eng):
    eng.submit(limit(eng, Side.SELL, 5010, 5))
    trades = eng.submit(limit(eng, Side.BUY, 5015, 5))  # willing to pay up to 5015
    assert trades[0].price == 5010                      # but gets the resting 5010
    assert eng.book.best_ask() is None


# --- IOC / FOK -----------------------------------------------------------
def test_ioc_cancels_remainder(eng):
    eng.submit(limit(eng, Side.SELL, 5010, 3))
    trades = eng.submit(limit(eng, Side.BUY, 5010, 10, tif=TimeInForce.IOC))
    assert sum(t.quantity for t in trades) == 3
    assert eng.book.best_bid() is None  # nothing rests


def test_fok_all_or_nothing(eng):
    eng.submit(limit(eng, Side.SELL, 5010, 3))
    trades = eng.submit(limit(eng, Side.BUY, 5010, 10, tif=TimeInForce.FOK))
    assert trades == []                 # can't fill 10, so fill 0
    assert eng.book.best_ask() == 5010  # resting sell untouched


def test_fok_fills_when_possible(eng):
    eng.submit(limit(eng, Side.SELL, 5010, 10))
    trades = eng.submit(limit(eng, Side.BUY, 5010, 10, tif=TimeInForce.FOK))
    assert sum(t.quantity for t in trades) == 10


# --- cancel / modify -----------------------------------------------------
def test_cancel(eng):
    o = limit(eng, Side.BUY, 5000, 5)
    eng.submit(o)
    assert eng.cancel(o.id) is True
    assert eng.book.best_bid() is None
    assert eng.cancel(o.id) is False  # already gone


def test_modify_loses_time_priority(eng):
    a = limit(eng, Side.BUY, 5000, 5, tid="A")
    b = limit(eng, Side.BUY, 5000, 5, tid="B")
    eng.submit(a)
    eng.submit(b)
    eng.modify(a.id, new_quantity=5, new_price=5000)  # A re-queued behind B
    trades = eng.submit(market(eng, Side.SELL, 5))
    assert trades[0].maker_trader_id == "B"  # B now first


# --- stop orders ---------------------------------------------------------
def test_stop_triggers_on_price(eng):
    # seed a last price and some liquidity
    eng.submit(limit(eng, Side.SELL, 5010, 5))
    eng.submit(market(eng, Side.BUY, 1))       # last_price = 5010
    # place a buy-stop at 5020 (not yet triggered)
    stop = Order(id=eng.next_id(), side=Side.BUY, type=OrderType.STOP,
                 quantity=2, stop_price=5020)
    eng.submit(stop)
    assert eng.book.best_ask() == 5010  # still resting, stop dormant
    # push price up to 5020 -> stop should fire and consume liquidity.
    # 4 units remain resting at 5010; buy 6 clears them then trades into 5020.
    eng.submit(limit(eng, Side.SELL, 5020, 10))
    eng.submit(market(eng, Side.BUY, 6))       # 4@5010 then 2@5020, triggers stop
    assert eng.last_price == 5020
    # stop bought 2 more at 5020, leaving 10 - 2 - 2 = 6 on the ask
    assert eng.book.best_ask_level().volume == 6
