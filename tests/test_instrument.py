from decimal import Decimal

import pytest

from agora import Instrument


@pytest.fixture
def stock():
    return Instrument("AGORA", tick_size=Decimal("0.01"), lot_size=1)


def test_price_to_ticks_roundtrip(stock):
    assert stock.to_ticks("50.01") == 5001
    assert stock.to_price(5001) == Decimal("50.01")


def test_off_grid_price_rejected(stock):
    with pytest.raises(ValueError):
        stock.to_ticks("50.005")  # between ticks on a 0.01 grid


def test_tiered_tick(stock):
    inst = Instrument("BIG", tick_size=Decimal("0.05"))
    assert inst.to_ticks("50.05") == 1001
    with pytest.raises(ValueError):
        inst.to_ticks("50.07")


def test_quantity_must_be_int(stock):
    with pytest.raises(TypeError):
        stock.validate_qty(1.5)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        stock.validate_qty(0)


def test_lot_multiple_enforced():
    inst = Instrument("LOT", lot_size=100)
    assert inst.validate_qty(300) == 300
    with pytest.raises(ValueError):
        inst.validate_qty(150)
