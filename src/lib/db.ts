import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as unknown as { mizanPool?: Pool };

// APP_DATABASE_URL = the restricted app role (mizan_app, NOBYPASSRLS). The Vercel–Neon
// integration injects DATABASE_URL / POSTGRES_URL as the database OWNER, which has
// BYPASSRLS in Neon — connecting with it would silently disable tenant isolation.
// So on Vercel every query fails with a clear error without APP_DATABASE_URL, instead of
// falling back. (Checked at query time, not import time, so `next build` still succeeds.)
const MISCONFIGURED = !!process.env.VERCEL && !process.env.APP_DATABASE_URL;
const MISCONFIGURED_MESSAGE = 'APP_DATABASE_URL is not set: the app must connect as the restricted mizan_app role, never as the Neon owner (see DEPLOY_VERCEL.md).';
let connectionString = MISCONFIGURED ? undefined : process.env.APP_DATABASE_URL
  || process.env.DATABASE_URL
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
  if (MISCONFIGURED) {
    const refuse = () => Promise.reject(new Error(MISCONFIGURED_MESSAGE));
    p.connect = refuse as unknown as Pool['connect'];
    p.query = refuse as unknown as Pool['query'];
  }
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

// Platform-owner (super admin) operations run with app.platform_owner = 'true'
// allowing aggregate reads across all tenant records without hardcoding specific tenant IDs.
export async function withPlatformOwner<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.platform_owner', 'true', true)");
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch {}
    throw error;
  } finally { db.release(); }
}

