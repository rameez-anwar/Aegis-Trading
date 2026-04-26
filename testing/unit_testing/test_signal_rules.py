import numpy as np

from signals.technical_indicator_signal.signal_rules import (
    rsi_rule,
    macd_rule,
    sma_rule,
)


def test_rsi_rule_overbought_is_sell():
    assert rsi_rule(71) == -1
    assert rsi_rule(100) == -1


def test_rsi_rule_oversold_is_buy():
    assert rsi_rule(29) == 1
    assert rsi_rule(0) == 1


def test_rsi_rule_neutral_is_hold():
    assert rsi_rule(50) == 0
    assert rsi_rule(70) == 0
    assert rsi_rule(30) == 0


def test_macd_rule_sign_logic():
    assert macd_rule(0.01) == 1
    assert macd_rule(-0.01) == -1
    assert macd_rule(0.0) == 0


def test_sma_rule_requires_row_close_vs_sma():
    row = {"close": 105.0, "sma_20": 100.0}
    assert sma_rule(row, period=20) == 1

    row = {"close": 95.0, "sma_20": 100.0}
    assert sma_rule(row, period=20) == -1

    row = {"close": 100.0, "sma_20": 100.0}
    assert sma_rule(row, period=20) == 0


def test_signal_rules_accept_numpy_scalars():
    assert rsi_rule(np.float64(29.0)) == 1
    assert macd_rule(np.float64(-0.1)) == -1

