import { Pool, type PoolClient } from 'pg';
const globalDb = globalThis as unknown as { mizanPool?: Pool };
const connectionString = process.env.DATABASE_URL;
// Managed Postgres (Neon/Supabase/RDS…) requires TLS; a local database does not.
// Enable SSL for any non-localhost host unless the URL explicitly disables it.
const remote = !!connectionString && !/@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const useSsl = remote && !/sslmode=disable/.test(connectionString!);
export const pool = globalDb.mizanPool ?? new Pool({ connectionString, max: 10, ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}) });
if (process.env.NODE_ENV !== 'production') globalDb.mizanPool = pool;

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
    await db.query('ROLLBACK');
    throw error;
  } finally { db.release(); }
}
