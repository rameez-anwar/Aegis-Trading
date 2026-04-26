const request = require('supertest');

jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: jest.fn(async () => ({ rows: [] })),
    })),
  };
});

const { createApp } = require('../../../backend/app');

describe('Backend API unit tests', () => {
  test('GET / returns API metadata', async () => {
    const { app } = createApp();
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Aegis Trading API');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('endpoints');
  });

  test('GET /api/health returns OK when DB responds', async () => {
    const mockPool = { query: jest.fn(async () => ({ rows: [{ '?column?': 1 }] })) };
    const { app } = createApp({ pool: mockPool });
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('database', 'Connected');
  });

  test('GET /api/health returns ERROR when DB fails', async () => {
    const mockPool = { query: jest.fn(async () => { throw new Error('db down'); }) };
    const { app } = createApp({ pool: mockPool });
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('status', 'ERROR');
    expect(res.body).toHaveProperty('database', 'Disconnected');
  });
});

