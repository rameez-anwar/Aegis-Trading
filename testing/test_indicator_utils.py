import random

from strategies.strategy_pipeline.utils.indicator_utils import (
    IndicatorConfig,
    get_enabled_indicators,
    random_select_indicators,
)


def test_get_enabled_indicators_is_case_insensitive():
    config = {"rsi": "TRUE", "macd": "true", "adx": "False", "ema": "TrUe"}
    enabled = get_enabled_indicators(config)
    assert set(enabled) == {"rsi", "macd", "ema"}


def test_indicator_config_random_window_returns_none_if_no_windows():
    cfg = IndicatorConfig("macd", "momentum", valid_windows=None)
    assert cfg.random_window() is None


def test_random_select_indicators_returns_at_most_n_and_subset():
    random.seed(123)
    enabled = ["a", "b", "c", "d"]
    picked = random_select_indicators(enabled, n=2)
    assert len(picked) == 2
    assert set(picked).issubset(set(enabled))


def test_random_select_indicators_when_n_exceeds_length_returns_all_unique():
    random.seed(123)
    enabled = ["a", "b", "c"]
    picked = random_select_indicators(enabled, n=10)
    assert set(picked) == set(enabled)
    assert len(picked) == len(enabled)

