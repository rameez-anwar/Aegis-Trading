const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables for integration testing.
// Tries backend/.env first (when running from backend/), then project root .env.
(() => {
  // eslint-disable-next-line global-require
  const dotenv = require('dotenv');

  const backendEnvPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
    return;
  }

  const rootEnvPath = path.resolve(process.cwd(), '..', '.env');
  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  }
})();

function buildConnectionStringFromPgEnv() {
  const user = process.env.PG_USER;
  const password = process.env.PG_PASSWORD;
  const host = process.env.PG_HOST;
  const port = process.env.PG_PORT;
  const db = process.env.PG_DB;

  if (!user || !host || !port || !db) return null;

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = password != null ? encodeURIComponent(password) : null;

  return encodedPassword
    ? `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${db}`
    : `postgresql://${encodedUser}@${host}:${port}/${db}`;
}

describe('Database integration (PostgreSQL connectivity)', () => {
  const cs = process.env.TEST_DATABASE_URL || buildConnectionStringFromPgEnv();

  (cs ? test : test.skip)('connects to PostgreSQL and executes SELECT 1', async () => {
    const pool = new Pool({ connectionString: cs });
    try {
      const res = await pool.query('SELECT 1');
      expect(res).toBeTruthy();
    } finally {
      await pool.end().catch(() => {});
    }
  });
});

