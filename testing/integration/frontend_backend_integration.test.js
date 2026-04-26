const http = require('http');

const { createApp } = require('../../backend/app');

describe('Full-stack integration (frontend-style HTTP client ↔ backend API)', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    // Inject a mock DB pool so the server can start deterministically
    const mockPool = { query: jest.fn(async () => ({ rows: [{ '?column?': 1 }] })) };
    const { app } = createApp({ pool: mockPool });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve)); // ephemeral port
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise((resolve) => server.close(resolve));
  });

  test('Frontend can call backend root endpoint and read JSON', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('message', 'Aegis Trading API');
  });

  test('Frontend can call backend health endpoint and receive OK status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('status', 'OK');
  });
});

