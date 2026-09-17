# Aegis Trading

**A Hybrid System for Cryptocurrency Signal Generation and Trade Execution Using AI and Technical Indicators**

Final Year Project — an end-to-end platform that combines technical-indicator strategies with machine learning models to generate cryptocurrency trading signals, backtest performance, and execute trades on Bybit (demo).

---

## Overview

Aegis Trading ingests market data from Binance and Bybit, builds signals from TA-Lib indicators and supervised ML predictors, evaluates strategies through backtesting and performance stats, and exposes everything through a React dashboard with optional live demo execution.

```
Market Data (Binance / Bybit)
        ↓
   PostgreSQL
        ↓
┌───────────────────┬────────────────────┐
│ Technical         │ Machine Learning   │
│ Indicators +      │ Models             │
│ Strategy Pipeline │ (train → signals)  │
└─────────┬─────────┴──────────┬─────────┘
          ↓                    ↓
     Backtest & Stats    Hybrid Execution
          ↓                    ↓
   Express API  ←→  React Dashboard
```

---

## Features

- **Market data ingestion** — historical OHLCV from Binance and Bybit into PostgreSQL
- **Technical indicators** — TA-Lib–based indicator catalog and rule-based signal generation
- **Strategy pipeline** — configurable / Optuna-optimized strategy generation and live strategy signals
- **Machine learning** — multiple models (linear/ridge, trees, Random Forest, XGBoost, SVM, LSTM, GRU) for price prediction and ML signals
- **Hybrid execution** — Bybit demo trading driven by selected strategies and optional ML signals
- **Backtesting & analytics** — PnL simulation and metrics (e.g. Sharpe, Sortino, CAGR)
- **Web application** — auth (email/password + Google OAuth), strategy/model dashboards, account settings, positions, and ledgers

---

## Tech Stack

| Layer | Technologies |
|--------|----------------|
| Frontend | React 18, React Router, Tailwind CSS, Axios, Recharts |
| Backend | Node.js, Express, JWT, bcrypt, Nodemailer, Google Auth |
| Database | PostgreSQL |
| Data & TA | pandas, NumPy, TA-Lib, python-binance, pybit |
| ML | scikit-learn, XGBoost, TensorFlow, Optuna |
| Testing | pytest, Jest, Supertest |

---

## Project Structure

```
AegisTradingFYP/
├── backend/                 # Express API (auth, strategies, models, Bybit helpers)
├── frontend/client/         # React dashboard
├── data/                    # Exchange fetchers & downloader
├── indicators/              # TA-Lib technical indicator wrappers
├── signals/                 # Indicator-based signal rules & generators
├── strategies/              # Strategy generation, optimization, signal pipeline
├── ml/                      # Model learners, training, ML signal generation
├── backtest/                # Strategy backtesting
├── stats/                   # Performance statistics
├── execution/               # Bybit demo trader (strategy-driven)
├── execution2/              # Multi-user unified strategy + ML trader
├── testing/                 # Python & JS tests
├── requirements.txt         # Python dependencies
└── package.json             # Root npm scripts
```

---

## Prerequisites

- **Node.js** (v18+ recommended)
- **Python** 3.10+
- **PostgreSQL**
- **TA-Lib** system library (required by the `TA-Lib` Python package)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/rameez-anwar/Aegis-Trading.git
cd Aegis-Trading
```

### 2. Python environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Node dependencies

```bash
npm run install:all
```

### 4. Environment variables

Create a `.env` file in the project root (and/or `backend/.env` and `frontend/client/.env` as needed):

```env
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password
PG_DB=crypto_signals

# Python imports (optional but recommended)
PYTHONPATH=.

# Backend
PORT=5000
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id

# Email (verification / password reset)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Bybit (backend helpers; demo by default)
BYBIT_BASE_URL=https://api-demo.bybit.com
BYBIT_RECV_WINDOW=5000
```

User trading API keys can also be stored per account in the database via the Account page.

### 5. Database

Create a PostgreSQL database named `crypto_signals` (or match `PG_DB`). The application uses schemas such as:

- `{exchange}_data` — OHLCV
- `signals` — generated signals
- `strategies_backtest` — backtest results
- `ml_summary` / related ML tables
- `execution` — trade ledgers
- `users` — accounts and settings
- `stats` — performance metrics

---

## Running the Application

Start the API and UI in separate terminals:

```bash
# Terminal 1 — Backend (http://localhost:5000)
npm run backend:dev

# Terminal 2 — Frontend (http://localhost:3000)
npm run frontend:dev
```

Health check: `GET http://localhost:5000/api/health`

---

## Offline Pipeline (Python)

Typical research / training flow (PostgreSQL required):

| Step | Example entrypoint |
|------|--------------------|
| Download market data | `data/binance/main.py`, `data/bybit/main.py` |
| Generate strategies | `strategies/strategy_pipeline/generator.py` |
| Generate strategy signals | `strategies/strategy_pipeline/signal_pipeline.py` |
| Optimize strategies | `strategies/strategy_pipeline/strategies_optimized.py` |
| Backtest | `backtest/main.py` |
| Compute stats | `stats/main.py` |
| Train ML models | `ml/main.py` (see `ml/config.ini`) |
| Live demo trading | `python execution2/bybit/main.py --user <id>` |

Configuration INI files live under modules such as `ml/config.ini`, `signals/technical_indicator_signal/config.ini`, and `strategies/strategy_pipeline/strategy_config.ini`.

---

## Testing

```bash
# All suites
npm test

# Individually
npm run test:python
npm run test:backend
npm run test:frontend
```

---

## Key Modules

| Concern | Location |
|---------|----------|
| Indicators | `indicators/technical_indicator.py` |
| Signal rules | `signals/technical_indicator_signal/` |
| Strategy pipeline | `strategies/strategy_pipeline/` |
| ML learners & training | `ml/learner/`, `ml/main.py`, `ml/signal_generator.py` |
| Hybrid execution | `execution2/bybit/unified_signal_generator.py` |
| API server | `backend/server.js` |
| Dashboard | `frontend/client/src/` |

---

## Disclaimer

This project is developed for **academic / educational** purposes as a Final Year Project. Cryptocurrency trading involves substantial risk. Demo / paper trading environments should be preferred; do not use real capital without understanding the risks involved. Past backtest performance does not guarantee future results.

---

## License

MIT
