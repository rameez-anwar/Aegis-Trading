## 5.2 Unit Testing (PyTest)

### Tools used
- **PyTest**: Python unit testing framework used to run test cases and produce pass/fail results.

### Scope of unit testing
Unit tests were designed to validate **individual functions/components** that are deterministic and do not require external systems such as Bybit API or PostgreSQL. This ensures fast and repeatable testing.

Covered components:
- **Backtesting core logic**: `backtest/backtest.py` (`Backtester.merge_data()` and `Backtester.run()` key trade outcomes).
- **Technical indicator signal rules**: `signals/technical_indicator_signal/signal_rules.py` (rule functions such as RSI, MACD, SMA).
- **Indicator configuration utilities**: `strategies/strategy_pipeline/utils/indicator_utils.py` (enabled indicator parsing and random selection logic).

### Test cases and expected outcomes

#### A) Backtester (`testing/test_backtester.py`)

1) **Merge + rename behavior**
- **Test case**: Merge OHLCV with signals containing a `final_signal` column.
- **Expected outcome**:
  - Output index is `datetime` (floored to minutes),
  - `final_signal` is renamed to `signal`,
  - signals align correctly by minute.

2) **Long trade hits Take Profit (TP)**
- **Test case**: Enter long at open price, next candle high reaches TP threshold.
- **Expected outcome**:
  - Results contain actions `buy` then `tp`,
  - final balance increases (profit).

3) **Short trade hits Stop Loss (SL)**
- **Test case**: Enter short at open price, next candle high reaches SL threshold.
- **Expected outcome**:
  - Results contain actions `sell` then `sl`,
  - final balance decreases (loss).

4) **Balance protection stops backtest**
- **Test case**: Force a large loss so the balance falls under `min_balance`.
- **Expected outcome**:
  - `backtest_stopped` becomes `True`,
  - a final record is produced before stopping.

#### B) Signal rules (`testing/test_signal_rules.py`)

1) **RSI threshold logic**
- **Test case**: RSI > 70, RSI < 30, RSI in-between.
- **Expected outcome**:
  - RSI > 70 → `-1` (sell),
  - RSI < 30 → `1` (buy),
  - otherwise → `0` (hold).

2) **MACD sign logic**
- **Test case**: MACD value positive/negative/zero.
- **Expected outcome**:
  - positive → `1`,
  - negative → `-1`,
  - zero → `0`.

3) **SMA rule comparison**
- **Test case**: `close` above/below/equal to `sma_20`.
- **Expected outcome**:
  - close > SMA → `1`,
  - close < SMA → `-1`,
  - equal → `0`.

#### C) Indicator utilities (`testing/test_indicator_utils.py`)

1) **Enabled indicator parsing**
- **Test case**: mixed-case string values `TRUE/true/False`.
- **Expected outcome**: only keys mapped to `"true"` (case-insensitive) are returned.

2) **Random window selection**
- **Test case**: `IndicatorConfig` with no valid windows.
- **Expected outcome**: returns `None`.

3) **Random selection bounds**
- **Test case**: request `n` indicators from a list.
- **Expected outcome**:
  - returns at most `n`,
  - returned values are a subset of enabled list,
  - when `n` exceeds list length, returns all unique indicators.

### How to run unit tests
From the project root:

```bash
pip install -r requirements.txt
pytest
```

