from agora.simulation import default_market, _seed_book


def test_market_produces_emergent_trades():
    sim = default_market(seed=7)
    _seed_book(sim)
    analytics = sim.run(300)
    s = analytics.summary()
    assert s["trade_count"] > 0            # a price emerged from order flow
    assert s["last_price"] is not None
    assert s["total_volume"] > 0
    assert len(analytics.snapshots) == 300


def test_deterministic_with_seed():
    a = default_market(seed=1); _seed_book(a)
    b = default_market(seed=1); _seed_book(b)
    a.run(200); b.run(200)
    assert a.engine.last_price == b.engine.last_price
    assert len(a.engine.trades) == len(b.engine.trades)


def test_market_maker_tracks_inventory():
    from agora.simulation import Simulation
    from agora.instrument import Instrument
    from agora.traders import MarketMaker, AggressiveBuyer
    mm = MarketMaker("MM", half_spread=3, quote_size=20)
    sim = Simulation(Instrument("AGORA"), [mm, AggressiveBuyer("BUY", qty=5, activity=1.0)], seed=3)
    _seed_book(sim)
    sim.run(50)
    # aggressive buying lifts the MM's offers -> MM ends up short (negative inv)
    assert mm.inventory <= 0
