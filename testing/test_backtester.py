import pandas as pd

from backtest.backtest import Backtester


def _make_ohlcv(datetimes, open_, high, low, close=None):
    if close is None:
        close = open_
    return pd.DataFrame(
        {
            "datetime": pd.to_datetime(datetimes),
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
        }
    )


def test_merge_data_renames_final_signal_to_signal_and_sets_datetime_index():
    ohlcv = _make_ohlcv(
        ["2026-01-01 00:00:10", "2026-01-01 00:01:10"],
        open_=[100, 101],
        high=[101, 102],
        low=[99, 100],
        close=[100, 101],
    )
    signals = pd.DataFrame(
        {
            "datetime": pd.to_datetime(["2026-01-01 00:00:59", "2026-01-01 00:01:00"]),
            "final_signal": [1, -1],
        }
    )

    bt = Backtester(ohlcv, signals)
    merged = bt.merge_data()

    assert merged.index.name == "datetime"
    assert "signal" in merged.columns
    assert "final_signal" not in merged.columns
    assert merged.loc[pd.Timestamp("2026-01-01 00:00:00"), "signal"] == 1
    assert merged.loc[pd.Timestamp("2026-01-01 00:01:00"), "signal"] == -1


def test_run_long_trade_hits_take_profit():
    ohlcv = _make_ohlcv(
        ["2026-01-01 00:00:00", "2026-01-01 00:01:00"],
        open_=[100, 100],
        high=[100, 106],  # TP hit at second candle
        low=[100, 99],
        close=[100, 105],
    )
    signals = pd.DataFrame(
        {
            "datetime": pd.to_datetime(["2026-01-01 00:00:00", "2026-01-01 00:01:00"]),
            "signal": [1, 0],
        }
    )

    bt = Backtester(ohlcv, signals, tp=0.05, sl=0.03, initial_balance=1000, fee_percent=0.0)
    results = bt.run()

    assert list(results["action"]) == ["buy", "tp"]
    assert results.iloc[0]["buy_price"] == 100
    assert results.iloc[1]["sell_price"] == 106  # uses high_price when TP hit
    assert results.iloc[-1]["balance"] > 1000


def test_run_short_trade_hits_stop_loss():
    ohlcv = _make_ohlcv(
        ["2026-01-01 00:00:00", "2026-01-01 00:01:00"],
        open_=[100, 100],
        high=[100, 104],  # SL hit for short (entry 100, sl=3% => 103)
        low=[100, 95],
        close=[100, 103],
    )
    signals = pd.DataFrame(
        {
            "datetime": pd.to_datetime(["2026-01-01 00:00:00", "2026-01-01 00:01:00"]),
            "signal": [-1, 0],
        }
    )

    bt = Backtester(ohlcv, signals, tp=0.05, sl=0.03, initial_balance=1000, fee_percent=0.0)
    results = bt.run()

    assert list(results["action"]) == ["sell", "sl"]
    assert results.iloc[1]["sell_price"] == 104  # uses high_price when SL hit for short
    assert results.iloc[-1]["balance"] < 1000


def test_balance_protection_stops_backtest_when_below_min_balance():
    # A single losing trade that drops balance under min_balance should stop.
    ohlcv = _make_ohlcv(
        ["2026-01-01 00:00:00", "2026-01-01 00:01:00"],
        open_=[100, 100],
        high=[100, 100],
        low=[100, 0],  # extreme SL execution to force big loss
        close=[100, 0],
    )
    signals = pd.DataFrame(
        {
            "datetime": pd.to_datetime(["2026-01-01 00:00:00", "2026-01-01 00:01:00"]),
            "signal": [1, 0],
        }
    )

    bt = Backtester(
        ohlcv,
        signals,
        tp=0.05,
        sl=0.03,
        initial_balance=1000,
        fee_percent=0.0,
        min_balance=999,  # stop quickly once any loss happens
    )
    results = bt.run()

    assert bt.backtest_stopped is True
    assert len(results) >= 2  # buy + sl record present

