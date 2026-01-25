import os
import pandas as pd
import configparser
import random
import datetime
import optuna
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import create_engine, MetaData, Table, Column, String, Boolean, DateTime, Integer, Float, text
from dotenv import load_dotenv
from collections import Counter
from indicators.technical_indicator import IndicatorCalculator
from signals.technical_indicator_signal.signal_generator import SignalGenerator
from strategies.strategy_pipeline.utils.indicator_utils import get_all_indicator_configs
from backtest.backtest import Backtester
from data.utils.db_utils import get_pg_engine

# Configure logging for minimal output
import logging
logging.basicConfig(level=logging.WARNING)
optuna.logging.set_verbosity(optuna.logging.WARNING)

# Load configuration and setup
load_dotenv()
engine = get_pg_engine()

config_path = os.path.join(os.path.dirname(__file__), 'strategy_config.ini')
config = configparser.ConfigParser()
config.read(config_path)

data = config['DATA']
limits = config['limits']
max_files = int(limits.get('max_strategy_files', 10))

# Parse configuration
exchanges = [e.strip() for e in data.get('exchange', '').split(',')]
symbols = [s.strip() for s in data.get('symbols', '').split(',')]
timeframes = [tf.strip() for tf in data.get('timeframes', '1h').split(',')]
start_date_str = data.get('start_date', '2020-01-01')
end_date_str = data.get('end_date', 'now')

start_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
end_date = datetime.datetime.now() if end_date_str == "now" else datetime.datetime.strptime(end_date_str, "%Y-%m-%d")

# Get the primary exchange and symbol for data loading
primary_exchange = exchanges[0] if exchanges else 'bybit'
primary_symbol = symbols[0] if symbols else 'btc'

# Get indicator configurations
indicator_catalog = get_all_indicator_configs()

# Get indicator names from config
indicator_config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'signals', 'technical_indicator_signal', 'config.ini')
indicator_config = configparser.ConfigParser()
indicator_config.read(indicator_config_path)
indicator_names = []
for section in indicator_config.sections():
    if section != 'DATA':
        indicator_names.extend(indicator_config[section].keys())
indicator_names = sorted(set(indicator_names))

# Create database schemas
metadata = MetaData()
with engine.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS signals;"))
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS strategies_backtest;"))

# Global OHLCV data cache to ensure consistency
GLOBAL_OHLCV_DATA = {}

def get_next_strategy_number():
    """Get the next available strategy number by checking existing strategies in the database"""
    print("Checking existing strategies in database...")
    
    try:
        with engine.connect() as conn:
            # Check if config_strategies table exists
            table_exists = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'config_strategies' AND table_schema = 'public'
                );
            """)).scalar()
            
            if not table_exists:
                print("  → No existing strategies table found, starting from strategy_01")
                return 1
            
            # Get all existing strategy names
            result = conn.execute(text("""
                SELECT name FROM public.config_strategies 
                WHERE name LIKE 'strategy_%' 
                ORDER BY name
            """)).fetchall()
            
            if not result:
                print("  → No existing strategies found, starting from strategy_01")
                return 1
            
            # Extract strategy numbers and find the highest
            strategy_numbers = []
            for row in result:
                strategy_name = row[0]
                # Extract number from strategy_XX format
                if strategy_name.startswith('strategy_'):
                    try:
                        number_str = strategy_name.replace('strategy_', '')
                        number = int(number_str)
                        strategy_numbers.append(number)
                    except ValueError:
                        continue
            
            if not strategy_numbers:
                print("  → No valid strategy numbers found, starting from strategy_01")
                return 1
            
            max_number = max(strategy_numbers)
            next_number = max_number + 1
            print(f"  → Found {len(strategy_numbers)} existing strategies")
            print(f"  → Highest strategy number: {max_number}")
            print(f"  → Next strategy number: {next_number}")
            
            return next_number
            
    except Exception as e:
        print(f"  → Error checking existing strategies: {e}")
        print("  → Starting from strategy_01")
        return 1

def load_global_ohlcv_data():
    """Load OHLCV data once and cache it globally for consistency"""
    global GLOBAL_OHLCV_DATA
    print("Loading global OHLCV data...")
    
    for symbol in symbols:
        ohlcv_table = f"{symbol}_1m"
        schema_name = f"{primary_exchange}_data"
        
        with engine.connect() as conn:
            table_exists = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = :table_name AND table_schema = :schema_name
                );
            """), {"table_name": ohlcv_table, "schema_name": schema_name}).scalar()
            
            if not table_exists:
                print(f"Warning: Table {schema_name}.{ohlcv_table} does not exist")
                continue
            
            # Load ALL available data without date filtering
            df = pd.read_sql_query(f"SELECT * FROM {schema_name}.{ohlcv_table} ORDER BY datetime", conn)
        
        # Process data consistently
        df['datetime'] = pd.to_datetime(df['datetime'])
        df = df.set_index('datetime').sort_index()
        
        # Store the COMPLETE dataset - no date filtering here
        if not df.empty:
            GLOBAL_OHLCV_DATA[symbol] = df
            print(f"  → Loaded {len(df)} rows for {symbol}")
            print(f"  → Data range: {df.index.min()} to {df.index.max()}")
        else:
            print(f"  → No data for {symbol}")

def get_ohlcv_data(symbol, timeframe, apply_date_filter=True, warmup_days=30):
    """Get consistent OHLCV data for backtesting with warmup period for indicators"""
    if symbol not in GLOBAL_OHLCV_DATA:
        raise ValueError(f"No data available for {symbol}")
    
    df = GLOBAL_OHLCV_DATA[symbol].copy()
    
    # Apply date filter only if requested
    if apply_date_filter:
        # Add warmup period before start_date for indicators
        warmup_start = start_date - datetime.timedelta(days=warmup_days)
        # Filter data with warmup period
        df = df[(df.index >= warmup_start) & (df.index <= end_date)]
    
    # Resample if needed
    if timeframe != '1m':
        resampling_dict = {
            'open': 'first',
            'high': 'max', 
            'low': 'min',
            'close': 'last',
            'volume': 'sum'
        }
        df = df.resample(timeframe).agg(resampling_dict).dropna()
    
    return df

def run_direct_backtest(ohlcv_df, signals_df, tp=None, sl=None, initial_balance=1000, fee_percent=0.0005):
    """Run backtest using the original Backtester class"""
    try:
        # Prepare data
        ohlcv_backtest = ohlcv_df.copy()
        signals_backtest = signals_df.copy()
        
        # Ensure datetime columns are properly formatted
        ohlcv_backtest['datetime'] = pd.to_datetime(ohlcv_backtest['datetime'])
        signals_backtest['datetime'] = pd.to_datetime(signals_backtest['datetime'])
        
        # Sort by datetime
        ohlcv_backtest = ohlcv_backtest.sort_values('datetime')
        signals_backtest = signals_backtest.sort_values('datetime')
        
        # Use default TP/SL if not provided
        if tp is None:
            tp = 0.04
        if sl is None:
            sl = 0.02
        
        # Create Backtester instance with original parameters
        backtester = Backtester(
            ohlcv_df=ohlcv_backtest, 
            signals_df=signals_backtest,
            tp=tp, 
            sl=sl,
            initial_balance=initial_balance,
            fee_percent=fee_percent
        )
        
        # Run backtest
        result = backtester.run()
        
        if not result.empty:
            return result.iloc[-1]['pnl_sum']
        else:
            return -1000  # Penalty for no trades
        
    except Exception as e:
        print(f"Backtest error: {e}")
        return -1000

def generate_base_strategies():
    """Generate base strategies in memory (not saved to DB yet)"""
    print("Generating base strategies in memory...")
    
    # Get the next strategy number to start from
    next_strategy_number = get_next_strategy_number()
    
    strategies = []
    global_strat_num = next_strategy_number
    total_strategies = len(exchanges) * len(symbols) * len(timeframes) * max_files
    width = max(2, len(str(total_strategies + next_strategy_number - 1)))
    
    for exchange in exchanges:
        for symbol in symbols:
            for tf in timeframes:
                for idx in range(max_files):
                    strat_name = f"strategy_{str(global_strat_num).zfill(width)}"
                    indicator_values = {ind: random.choice([True, False]) for ind in indicator_names}
                    strategy = {
                        'name': strat_name,
                        'exchange': exchange,
                        'symbol': symbol,
                        'time_horizon': tf,
                        **indicator_values
                    }
                    strategies.append(strategy)
                    global_strat_num += 1
    
    print(f"Generated {len(strategies)} base strategies starting from strategy_{str(next_strategy_number).zfill(width)}")
    return strategies

def create_strategy_table_with_window_columns():
    """Create strategy table with window size columns for each indicator"""
    print("Creating strategy table with window size columns...")
    
    # Base columns
    config_columns = [
        Column('name', String, primary_key=True),
        Column('exchange', String),
        Column('symbol', String),
        Column('time_horizon', String),
        Column('take_profit', Float),
        Column('stop_loss', Float),
    ]
    
    # Add indicator columns with their window size columns next to each other
    for ind in indicator_names:
        config_columns.append(Column(ind, Boolean))
        config_columns.append(Column(f'{ind}_window_size', Integer))
    
    config_table = Table('config_strategies', metadata, *config_columns, schema='public')
    
    # Create table if it doesn't exist (don't drop existing table)
    with engine.connect() as conn:
        if not engine.dialect.has_table(conn, 'config_strategies', schema='public'):
            metadata.create_all(engine, tables=[config_table])
            print("  → Created new config_strategies table")
        else:
            print("  → Using existing config_strategies table")
    
    return config_table

class StrategyOptimizer:
    def __init__(self, strategy_config, n_trials=100, pnl_threshold=100):
        self.strategy_config = strategy_config
        self.strategy_name = strategy_config['name']
        self.exchange = strategy_config['exchange']
        self.symbol = strategy_config['symbol']
        self.timeframe = strategy_config['time_horizon']
        self.n_trials = n_trials
        self.pnl_threshold = pnl_threshold
        self.ohlcv_data = None
        self.enabled_indicators = self._get_enabled_indicators()
        self.best_strategy = None
        
    def _get_enabled_indicators(self):
        """Get enabled indicators from strategy config"""
        return [ind_name for ind_name in indicator_names if self.strategy_config.get(ind_name) is True]
        
    def fetch_data(self):
        """Get consistent OHLCV data using global cache"""
        self.ohlcv_data = get_ohlcv_data(self.symbol, self.timeframe, apply_date_filter=True)
        
        if self.ohlcv_data.empty:
            raise ValueError(f"No data available for {self.symbol} {self.timeframe}")
    
    def generate_optimized_parameters(self, trial):
        """Generate optimized parameters using Optuna"""
        indicator_params = {}
        
        for ind_name in self.enabled_indicators:
            if ind_name in indicator_catalog:
                ind_config = indicator_catalog[ind_name]
                if ind_config.valid_windows and len(ind_config.valid_windows) > 1:
                    min_window = min(ind_config.valid_windows)
                    max_window = max(ind_config.valid_windows)
                    window = trial.suggest_int(f'{ind_name}_window', min_window, max_window)
                    indicator_params[ind_name] = window
                else:
                    indicator_params[ind_name] = 0
        
        # Use better risk/reward ratios: TP should be at least 2x SL
        # This ensures we need to win less often to be profitable
        tp = trial.suggest_float('tp', 0.04, 0.07)
        sl = trial.suggest_float('sl', 0.02, 0.05)
        
        
        return indicator_params, tp, sl
    
    def calculate_indicators_and_signals(self, indicator_params):
        """Calculate indicators and generate trading signals"""
        df = self.ohlcv_data.copy()
        calculator = IndicatorCalculator(df)
        calculated_indicators = []
        
        for ind_name, window in indicator_params.items():
            method_name = f"add_{ind_name}"
            if hasattr(calculator, method_name):
                try:
                    if window != 0:
                        getattr(calculator, method_name)(window)
                    else:
                        getattr(calculator, method_name)()
                    calculated_indicators.append(ind_name)
                except:
                    continue
        
        if not calculated_indicators:
            return None, None
            
        df_with_indicators = calculator.df
        indicator_columns = [col for col in df_with_indicators.columns 
                           if any(col.startswith(ind) or col == ind for ind in calculated_indicators)]
        df_with_indicators = df_with_indicators.dropna(subset=indicator_columns)
        
        if df_with_indicators.empty:
            return None, None
        
        # Apply date filter AFTER indicator calculation to get signals from start_date
        df_with_indicators = df_with_indicators[(df_with_indicators.index >= start_date) & (df_with_indicators.index <= end_date)]
        
        if df_with_indicators.empty:
            return None, None
        
        # Ensure datetime column
        if 'datetime' not in df_with_indicators.columns:
            df_with_indicators = df_with_indicators.reset_index()
            if 'index' in df_with_indicators.columns:
                df_with_indicators = df_with_indicators.rename(columns={'index': 'datetime'})
        
        # Generate signals
        sg = SignalGenerator(df_with_indicators, 
                           indicator_names=[col for col in df_with_indicators.columns 
                                          if any(col.startswith(ind) or col == ind for ind in calculated_indicators)])
        signal_df = sg.generate_signals()
        
        # Apply voting mechanism with stronger consensus threshold
        signal_cols = [col for col in signal_df.columns if col.startswith('signal_')]
        voted_signals = []
        min_consensus = 0.6  # At least 60% of indicators must agree (stronger filter)
        
        for i, row in signal_df.iterrows():
            votes = [row[col] for col in signal_cols]
            if not votes:
                voted_signals.append(0)
                continue
            
            count = Counter(votes)
            total_votes = len(votes)
            most_common = count.most_common()
            
            if not most_common:
                voted_signals.append(0)
            elif len(most_common) > 1 and most_common[0][1] == most_common[1][1]:
                # Tie - no clear signal
                voted_signals.append(0)
            elif most_common[0][1] / total_votes >= min_consensus:
                # Strong consensus - use the signal
                voted_signals.append(most_common[0][0])
            else:
                # Weak consensus - no signal
                voted_signals.append(0)
        
        # Apply signal confirmation: need 2 consecutive signals in same direction to enter new trade
        # This filters out false signals and reduces whipsaws
        # Once we have a confirmed signal, we keep it until it changes direction
        confirmed_signals = [0]  # First signal is always 0 (no previous signal to confirm)
        last_confirmed_signal = 0
        
        for i in range(1, len(voted_signals)):
            current_signal = voted_signals[i]
            previous_signal = voted_signals[i-1]
            
            # Need confirmation to change signal direction
            if current_signal != 0 and current_signal == previous_signal:
                # Confirmed signal - use it
                confirmed_signals.append(current_signal)
                last_confirmed_signal = current_signal
            elif current_signal == last_confirmed_signal:
                # Signal continues in same direction - keep it
                confirmed_signals.append(current_signal)
            elif current_signal == -last_confirmed_signal:
                # Signal reversed - need confirmation before changing
                if current_signal == previous_signal:
                    confirmed_signals.append(current_signal)
                    last_confirmed_signal = current_signal
                else:
                    # No confirmation yet - keep previous signal
                    confirmed_signals.append(last_confirmed_signal)
            else:
                # No clear signal - neutral
                confirmed_signals.append(0)
                last_confirmed_signal = 0
        
        signals_df = pd.DataFrame({
            'datetime': signal_df['datetime'],
            'signal': confirmed_signals
        })
        
        return df_with_indicators, signals_df
    
    def objective(self, trial):
        """Optuna objective function"""
        try:
            indicator_params, tp, sl = self.generate_optimized_parameters(trial)
            
            if not indicator_params:
                trial.report(-1000, step=0)
                trial.set_user_attr('pruned', True)
                raise optuna.TrialPruned()
            
            df_with_indicators, signals_df = self.calculate_indicators_and_signals(indicator_params)
            
            if signals_df is None or signals_df.empty:
                trial.report(-1000, step=0)
                trial.set_user_attr('pruned', True)
                raise optuna.TrialPruned()
            
            # Prepare OHLCV data for backtester
            ohlcv_backtest = self.ohlcv_data.reset_index()
            if 'datetime' not in ohlcv_backtest.columns:
                ohlcv_backtest = ohlcv_backtest.rename(columns={'index': 'datetime'})
            
            # Run backtest
            pnl_sum = run_direct_backtest(ohlcv_backtest, signals_df, tp, sl)
            
            # Report intermediate value for pruning
            trial.report(pnl_sum, step=0)
            
            # Prune if result is too bad
            if trial.should_prune():
                raise optuna.TrialPruned()
            
            # Store best strategy if above threshold
            if pnl_sum > self.pnl_threshold:
                if self.best_strategy is None or pnl_sum > self.best_strategy['pnl_sum']:
                    self.best_strategy = {
                        'indicator_params': indicator_params,
                        'tp': tp,
                        'sl': sl,
                        'pnl_sum': pnl_sum,
                        'signals_df': signals_df.copy(),
                        'trial_number': trial.number
                    }
            
            return pnl_sum
            
        except optuna.TrialPruned:
            raise
        except:
            return -1000
    
    def optimize(self):
        """Execute optimization process"""
        if not self.enabled_indicators:
            return None
        
        self.fetch_data()
        # Add pruning to stop bad trials early
        study = optuna.create_study(
            direction='maximize',
            pruner=optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=10)
        )
        study.optimize(self.objective, n_trials=self.n_trials, show_progress_bar=False)
        
        return None  # Study not used, return None

def _optimize_single_strategy(strategy, pnl_threshold):
    """Optimize a single strategy - used for parallel processing"""
    strategy_name = strategy['name']
    
    try:
        optimizer = StrategyOptimizer(
            strategy_config=strategy,
            n_trials=50,  # Reduced from 100 to speed up
            pnl_threshold=pnl_threshold
        )
        
        optimizer.optimize()
        
        if optimizer.best_strategy:
            # Verify PnL one more time
            ohlcv_data = get_ohlcv_data(strategy['symbol'], strategy['time_horizon'], apply_date_filter=True)
            ohlcv_backtest = ohlcv_data.reset_index()
            if 'datetime' not in ohlcv_backtest.columns:
                ohlcv_backtest = ohlcv_backtest.rename(columns={'index': 'datetime'})
            
            verified_pnl = run_direct_backtest(
                ohlcv_backtest, 
                optimizer.best_strategy['signals_df'],
                optimizer.best_strategy['tp'],
                optimizer.best_strategy['sl']
            )
            
            # Only proceed if verified PnL still meets threshold
            if verified_pnl > pnl_threshold:
                # Combine base strategy with optimized parameters
                optimized_strategy = strategy.copy()
                optimized_strategy['pnl_sum'] = verified_pnl
                optimized_strategy['tp'] = optimizer.best_strategy['tp']
                optimized_strategy['sl'] = optimizer.best_strategy['sl']
                
                # Add window sizes for each indicator
                for ind_name in indicator_names:
                    if ind_name in optimizer.best_strategy['indicator_params']:
                        window_size = optimizer.best_strategy['indicator_params'][ind_name]
                        optimized_strategy[f'{ind_name}_window_size'] = window_size
                    else:
                        optimized_strategy[f'{ind_name}_window_size'] = 0
                
                # Store signals for later saving
                optimized_strategy['signals_df'] = optimizer.best_strategy['signals_df']
                print(f"  ✓ {strategy_name}: PnL {verified_pnl:.1f}%")
                return optimized_strategy
            else:
                return None
        else:
            return None
            
    except Exception as e:
        return None

def optimize_all_strategies(base_strategies, pnl_threshold=100):
    """Optimize all base strategies and return successful ones - parallelized"""
    print(f"Starting optimization process (PnL threshold: {pnl_threshold}%)")
    
    optimized_strategies = []
    # Use fewer workers to reduce contention - CPU-bound tasks don't benefit from too many threads
    max_workers = min(len(base_strategies), os.cpu_count() or 4)
    
    # Use ThreadPoolExecutor for parallel optimization (I/O and CPU bound)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_optimize_single_strategy, strategy, pnl_threshold): strategy 
                   for strategy in base_strategies}
        
        completed = 0
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                optimized_strategies.append(result)
            completed += 1
            if completed % 5 == 0:
                print(f"  Progress: {completed}/{len(base_strategies)} strategies optimized")
    
    print(f"\nOptimization completed: {len(optimized_strategies)} strategies above threshold")
    return optimized_strategies

def save_optimized_strategies(optimized_strategies, config_table):
    """Save optimized strategies to database with window sizes"""
    print("Saving optimized strategies to database...")
    
    saved_count = 0
    
    for strategy in optimized_strategies:
        try:
            # Prepare strategy data for database
            strategy_data = strategy.copy()
            signals_df = strategy_data.pop('signals_df')
            pnl_sum = strategy_data.pop('pnl_sum', None)
            tp = strategy_data.pop('tp', None)
            sl = strategy_data.pop('sl', None)
            
            # Add TP and SL to strategy data with 2 decimal places
            if tp is not None:
                strategy_data['take_profit'] = round(tp, 2)
            if sl is not None:
                strategy_data['stop_loss'] = round(sl, 2)
            
            # Insert strategy into config_strategies table
            with engine.begin() as conn:
                conn.execute(config_table.insert().values(**strategy_data))
            
            # Save signals to signals schema
            strategy_name = strategy['name']
            signals_table = Table(
                strategy_name, metadata,
                Column('datetime', DateTime),
                Column('signal', Integer),
                schema='signals'
            )
            
            with engine.connect() as conn:
                if engine.dialect.has_table(conn, strategy_name, schema='signals'):
                    conn.execute(text(f"DROP TABLE signals.{strategy_name}"))
                metadata.create_all(engine, tables=[signals_table])
            
            signals_rows = [
                {'datetime': row.datetime, 'signal': row.signal}
                for row in signals_df.itertuples(index=False, name='SignalRow')
            ]
            
            with engine.begin() as conn:
                conn.execute(signals_table.insert(), signals_rows)
            
            print(f"  → Saved {strategy_name}: PnL {pnl_sum:.1f}%")
            saved_count += 1
            
        except Exception as e:
            print(f"  → Error saving {strategy['name']}: {e}")
            continue
    
    print(f"Successfully saved {saved_count} optimized strategies")

def _run_single_backtest(strategy):
    """Run backtest for a single strategy - used for parallel processing"""
    strategy_name = strategy['name']
    
    try:
        print(f"  → Running backtest for {strategy_name}...")
        
        symbol = strategy['symbol']
        exchange = strategy['exchange']
        tp = strategy['tp']
        sl = strategy['sl']
        initial_balance = 1000
        fee_percent = 0.0005
        
        # Get signals from the signals_df that was already calculated
        signals_df = strategy['signals_df']
        
        # Get OHLCV data based on exchange and symbol
        ohlcv_table = f"{exchange}_data.{symbol}_1m"
        with engine.connect() as conn:
            ohlcv = pd.read_sql_query(f"SELECT * FROM {ohlcv_table}", conn)
        
        # Prepare data
        ohlcv['datetime'] = pd.to_datetime(ohlcv['datetime'])
        signals_df['datetime'] = pd.to_datetime(signals_df['datetime'])
        ohlcv = ohlcv.sort_values('datetime')
        signals_df = signals_df.sort_values('datetime')
        
        print(f"    → OHLCV data: {len(ohlcv)} rows from {ohlcv['datetime'].min()} to {ohlcv['datetime'].max()}")
        print(f"    → Signals data: {len(signals_df)} rows from {signals_df['datetime'].min()} to {signals_df['datetime'].max()}")
        print(f"    → TP: {tp:.2f}, SL: {sl:.2f}")
        
        # Create Backtester instance with original parameters
        backtester = Backtester(
            ohlcv_df=ohlcv, 
            signals_df=signals_df,
            tp=tp,
            sl=sl,
            initial_balance=initial_balance,
            fee_percent=fee_percent
        )
        
        # Run backtest
        result = backtester.run()
        
        if not result.empty:
            # Round results
            result[['buy_price', 'sell_price', 'pnl_percent', 'pnl_sum', 'balance']] = \
                result[['buy_price', 'sell_price', 'pnl_percent', 'pnl_sum', 'balance']].round(2)
            
            # Save to DB
            backtest_table_name = f"{strategy_name}_backtest"
            result.to_sql(backtest_table_name, engine, schema='strategies_backtest', 
                        if_exists='replace', index=False)
            
            # Display results
            final_balance = result.iloc[-1]['balance']
            final_pnl = result.iloc[-1]['pnl_sum']
            total_trades = len(result[result['action'].isin(['tp', 'sl', 'direction_change'])])
            
            print(f"    Final Balance: {final_balance:.2f}")
            print(f"    Total Trades: {total_trades}")
            print(f"    Final PnL: {final_pnl:.1f}%")
            print(f"    Saved as: strategies_backtest.{backtest_table_name}")
            
            return True
        else:
            print(f"    No trades executed")
            return False
            
    except Exception as e:
        print(f"    Backtest failed: {e}")
        return False

def run_backtest_on_new_strategies(optimized_strategies):
    """Execute backtest only on newly created strategies - parallelized"""
    print("Running backtests on newly created strategies...")
    
    backtest_count = 0
    max_workers = min(len(optimized_strategies), (os.cpu_count() or 4) * 2)
    
    # Use ThreadPoolExecutor for parallel backtesting (I/O bound)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_run_single_backtest, strategy): strategy 
                   for strategy in optimized_strategies}
        
        for future in as_completed(futures):
            if future.result():
                backtest_count += 1
    
    print(f"Backtests completed: {backtest_count} files generated")

def _download_symbol_data(symbol):
    """Download data for a single symbol - used for parallel processing"""
    from data.downloaders.DataDownloader import DataDownloader
    
    try:
        print(f"  → Downloading latest data for {symbol}...")
        downloader = DataDownloader(exchange=primary_exchange, symbol=symbol, time_horizon='1m')
        df_1min, df_horizon = downloader.fetch_data(auto_download=True)
        
        if df_1min is not None and not df_1min.empty:
            print(f"    → Successfully downloaded {len(df_1min)} rows for {symbol}")
            print(f"    → Data range: {df_1min.index.min()} to {df_1min.index.max()}")
            return True
        else:
            print(f"    → Failed to download data for {symbol}")
            return False
    except Exception as e:
        print(f"    → Error downloading data for {symbol}: {e}")
        return False

def download_latest_data():
    """Download the latest data for all configured symbols - parallelized"""
    print("Downloading latest data for all symbols...")
    
    max_workers = min(len(symbols), (os.cpu_count() or 4) * 2)
    
    # Use ThreadPoolExecutor for parallel downloads (I/O bound)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_download_symbol_data, symbol): symbol for symbol in symbols}
        
        for future in as_completed(futures):
            future.result()  # Wait for completion

def main(pnl_threshold=100):
    """Execute complete optimization pipeline"""
    print("=" * 60)
    print("STRATEGY OPTIMIZATION PIPELINE")
    print("=" * 60)
    
    # Step 0: Download latest data
    download_latest_data()
    
    # Step 1: Load global OHLCV data
    load_global_ohlcv_data()
    
    # Step 2: Generate base strategies (will continue from next available number)
    base_strategies = generate_base_strategies()
    
    # Step 3: Create strategy table (won't drop existing table)
    config_table = create_strategy_table_with_window_columns()
    
    # Step 4: Optimize strategies
    optimized_strategies = optimize_all_strategies(base_strategies, pnl_threshold=pnl_threshold)
    
    # Step 5: Save optimized strategies
    if optimized_strategies:
        save_optimized_strategies(optimized_strategies, config_table)
        
        # Step 6: Run backtests only on newly created strategies
        run_backtest_on_new_strategies(optimized_strategies)
    else:
        print("No strategies met the PnL threshold")
    
    print("\nPipeline completed successfully")

if __name__ == "__main__":
    PNL_THRESHOLD = 10
    main(pnl_threshold=PNL_THRESHOLD) 