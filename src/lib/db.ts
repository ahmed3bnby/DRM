import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as unknown as { mizanPool?: Pool };

// Prefer an explicit DATABASE_URL; fall back to the names the Vercel–Neon
// integration provisions (with or without a NEON_ prefix) so the app connects
// without hand-editing env vars.
let connectionString = process.env.DATABASE_URL
  || process.env.NEON_DATABASE_URL
  || process.env.POSTGRES_URL
  || process.env.NEON_POSTGRES_URL;

// If connecting to Neon over the network, auto-upgrade to the connection pooler (-pooler)
// endpoint unless already using it. Neon pooler handles thousands of pooled
// connections safely in serverless environments without exhausting direct connection limits.
if (connectionString && /\.neon\.tech/i.test(connectionString) && !/-pooler\./i.test(connectionString)) {
  connectionString = connectionString.replace(/(@[a-z0-9_-]+)(\.[a-z0-9_.-]*neon\.tech)/i, '$1-pooler$2');
}

// Managed Postgres (Neon/Supabase/RDS…) requires TLS; a local database does not.
// Enable SSL for any non-localhost host unless the URL explicitly disables it.
const remote = !!connectionString && !/@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const useSsl = remote && !/sslmode=disable/.test(connectionString!);

function createPool(): Pool {
  const p = new Pool({
    connectionString,
    max: process.env.VERCEL ? 3 : 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
  });
  // Prevent idle connection drops from crashing the Node.js / serverless process
  p.on('error', (err) => {
    console.error('Unexpected error on idle pg client:', err?.message || err);
  });
  return p;
}

export const pool = globalDb.mizanPool ?? createPool();
// ALWAYS preserve mizanPool across requests on globalThis in both dev and production
globalDb.mizanPool = pool;

// Each operation has transaction-scoped tenant context. Pooled connections must
// never retain a tenant setting between requests or run tenant queries outside it.
export async function withTenant<T>(organizationId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch {}
    throw error;
  } finally { db.release(); }
}

