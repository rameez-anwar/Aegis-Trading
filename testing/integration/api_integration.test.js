const request = require('supertest');

// Avoid real PG connection during tests
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: jest.fn(async () => ({ rows: [] })),
    })),
  };
});

const { createApp } = require('../../backend/app');

describe('Backend integration testing (API + utilities + dependencies)', () => {
  beforeEach(() => {
    // Mock external HTTP fetch used by /api/market/price
    global.fetch = jest.fn(async (url) => {
      // Binance price endpoint mock
      if (String(url).includes('api.binance.com/api/v3/ticker/price')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ symbol: 'BTCUSDT', price: '12345.67' }),
          text: async () => '',
        };
      }

      // Bybit endpoint mock
      if (String(url).includes('api.bybit.com/v5/market/tickers')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            result: { list: [{ lastPrice: '25000.12' }] },
          }),
          text: async () => '',
        };
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
        text: async () => 'not found',
      };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('API root route returns metadata', async () => {
    // Inject pool to avoid startup schema checks warnings
    const mockPool = { query: jest.fn(async () => ({ rows: [] })) };
    const { app } = createApp({ pool: mockPool });
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Aegis Trading API');
    expect(res.body).toHaveProperty('endpoints');
  });

  test('Health route integrates with DB pool (success path)', async () => {
    const mockPool = { query: jest.fn(async () => ({ rows: [{ '?column?': 1 }] })) };
    const { app } = createApp({ pool: mockPool });
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
  });

  test('Market price route rejects missing symbol', async () => {
    const mockPool = { query: jest.fn(async () => ({ rows: [] })) };
    const { app } = createApp({ pool: mockPool });
    const res = await request(app).get('/api/market/price');
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('success', false);
  });

  test('Market price route (Binance) normalizes symbol and returns parsed price', async () => {
    const mockPool = { query: jest.fn(async () => ({ rows: [] })) };
    const { app } = createApp({ pool: mockPool });
    const res = await request(app).get('/api/market/price?exchange=binance&symbol=btc');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toMatchObject({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      price: 12345.67,
    });

    // Ensures normalizeTradingSymbol affected the outgoing URL
    const calledUrl = String(global.fetch.mock.calls[0][0]);
    expect(calledUrl).toContain('symbol=BTCUSDT');
  });

  test('Market price route (Bybit) returns parsed price', async () => {
    const mockPool = { query: jest.fn(async () => ({ rows: [] })) };
    const { app } = createApp({ pool: mockPool });
    const res = await request(app).get('/api/market/price?exchange=bybit&symbol=ETH');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data.symbol).toBe('ETHUSDT');
    expect(res.body.data.exchange).toBe('bybit');
    expect(res.body.data.price).toBe(25000.12);
  });
});

