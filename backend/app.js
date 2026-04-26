const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./utils/sendEmail');
require('dotenv').config();

const { normalizeTradingSymbol } = require('./lib/tradingUtils');

function createApp({ pool } = {}) {
  const app = express();

  // Database connection (can be injected for tests)
  const dbPool =
    pool ||
    new Pool({
      user: process.env.PG_USER || 'postgres',
      host: process.env.PG_HOST || 'localhost',
      database: process.env.PG_DB || 'crypto_signals',
      password: process.env.PG_PASSWORD || 'your_password_here',
      port: process.env.PG_PORT || 5432,
    });

  async function ensureUserLeverageSettingsColumn() {
    try {
      await dbPool.query(`
        ALTER TABLE users.users
        ADD COLUMN IF NOT EXISTS leverage_settings JSONB NOT NULL DEFAULT '{}'::jsonb
      `);
    } catch (e) {
      console.warn('Could not ensure leverage_settings column exists:', e.message);
    }
  }

  async function ensureUserPasswordResetColumns() {
    try {
      await dbPool.query(`
        ALTER TABLE users.users
        ADD COLUMN IF NOT EXISTS password_reset_code TEXT,
        ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ
      `);
    } catch (e) {
      console.warn('Could not ensure password reset columns exist:', e.message);
    }
  }

  function fetchJson(url) {
    return (async () => {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`.trim());
      }
      return await res.json();
    })();
  }

  function getBybitBaseUrl() {
    return process.env.BYBIT_BASE_URL || 'https://api-demo.bybit.com';
  }

  function bybitSign(secret, payload) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async function bybitRequest({ apiKey, apiSecret, method, endpointPath, queryParams, body }) {
    const baseUrl = getBybitBaseUrl();
    const url = new URL(`${baseUrl}${endpointPath}`);
    if (queryParams) {
      for (const [k, v] of Object.entries(queryParams)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      }
    }

    const timestamp = String(Date.now());
    const recvWindow = String(process.env.BYBIT_RECV_WINDOW || 60000);
    const bodyStr = body ? JSON.stringify(body) : '';

    const queryString = url.searchParams.toString();
    const paramStr = method === 'GET' ? queryString : bodyStr;
    const payload = `${timestamp}${apiKey}${recvWindow}${paramStr}`;
    const sign = bybitSign(apiSecret, payload);

    const headers = {
      'Content-Type': 'application/json',
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-SIGN': sign,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
    };

    const res = await fetch(url.toString(), { method, headers, body: method === 'GET' ? undefined : bodyStr });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(morgan('combined'));
  app.use(express.json());

  // Auth helpers
  const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

  function generateJwtToken(user) {
    return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  async function authMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  }

  // Routes (kept same as server.js, just using dbPool)
  app.get('/', (req, res) => {
    res.json({
      message: 'Aegis Trading API',
      version: '1.0.0',
      endpoints: {
        strategies: '/api/strategies',
        signup: '/api/auth/signup',
        login: '/api/auth/login',
        me: '/api/auth/me',
        testEmail: '/api/test-email',
      },
    });
  });

  app.get('/api/market/price', async (req, res) => {
    try {
      const exchange = String(req.query.exchange || 'bybit').toLowerCase();
      const symbol = normalizeTradingSymbol(req.query.symbol);
      if (!symbol) return res.status(400).json({ success: false, error: 'symbol is required' });

      let price = null;
      let source = null;

      if (exchange === 'binance') {
        const data = await fetchJson(
          `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`
        );
        price = data && data.price ? parseFloat(data.price) : null;
        source = 'binance';
      } else {
        const data = await fetchJson(
          `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${encodeURIComponent(symbol)}`
        );
        const list = data && data.result && Array.isArray(data.result.list) ? data.result.list : [];
        const item = list[0];
        const p = item && (item.lastPrice ?? item.markPrice);
        price = p != null ? parseFloat(p) : null;
        source = 'bybit';
      }

      if (!Number.isFinite(price)) {
        return res.status(502).json({ success: false, error: 'Failed to fetch price', details: { exchange, symbol } });
      }

      return res.json({
        success: true,
        data: { exchange: source, symbol, price, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      console.error('Live price error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch live price', message: err.message });
    }
  });

  // Health check endpoint (unit-test friendly)
  app.get('/api/health', async (req, res) => {
    try {
      await dbPool.query('SELECT 1');
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'Connected',
      });
    } catch (error) {
      res.status(500).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'Disconnected',
        error: error.message,
      });
    }
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something went wrong!', message: err.message });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  // Best-effort schema upgrade (skip in tests if injected pool is a mock)
  if (!pool) {
    ensureUserLeverageSettingsColumn();
    ensureUserPasswordResetColumns();
  }

  return { app, pool: dbPool, authMiddleware, generateJwtToken, bybitRequest };
}

module.exports = { createApp };

