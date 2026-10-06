/**
 * Repair: re-activate source versions whose ACTIVE version has 0 records while an
 * INACTIVE version of the same source still holds the data.
 *
 * Root cause: a sync can reuse/activate a version that an earlier cleanup had gutted,
 * leaving an "active" source with zero searchable records (so screening silently
 * misses every hit on that list). This script re-points `active` to the inactive
 * version that actually has the most records — restoring search immediately.
 *
 * Idempotent and safe: only flips the `active` flag, never deletes data. Codes that
 * have no records in ANY version are reported as "needs a real sync" (nothing to
 * recover locally).
 *
 * Run:  node --env-file=.env.local --import tsx scripts/repair-active-source-versions.ts
 */
import { Pool } from 'pg';

const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL!;
const ssl = !/@(localhost|127\.0\.0\.1)[:/]/.test(url) && !/sslmode=disable/.test(url);
const db = new Pool({ connectionString: url, ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}) });

async function main() {
  // Per code: the active version's record count, and the best (most records) version overall.
  const { rows } = await db.query<{
    code: string; active_id: string | null; active_recs: number; best_id: string | null; best_recs: number;
  }>(`
    WITH per_ver AS (
      SELECT sv.code, sv.id, sv.active,
             (SELECT count(*) FROM source_records r WHERE r.version_id = sv.id)::int AS recs
      FROM source_versions sv
    )
    SELECT code,
      (array_agg(id)        FILTER (WHERE active))[1]                      AS active_id,
      COALESCE(max(recs)    FILTER (WHERE active), 0)                      AS active_recs,
      (array_agg(id ORDER BY recs DESC))[1]                               AS best_id,
      max(recs)                                                           AS best_recs
    FROM per_ver
    GROUP BY code
  `);

  const broken = rows.filter(r => r.active_recs === 0);
  const recoverable = broken.filter(r => r.best_recs > 0 && r.best_id);
  const needsSync = broken.filter(r => r.best_recs === 0);

  console.log(`Sources with an empty ACTIVE version: ${broken.length}`);
  console.log(`  → recoverable from an inactive version: ${recoverable.length}`);
  console.log(`  → never loaded locally (need a real sync): ${needsSync.length}`);

  let repaired = 0;
  for (const r of recoverable) {
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [r.code]);
      // Deactivate the empty active version first (one_active_source allows only one active/code).
      await c.query('UPDATE source_versions SET active = false WHERE code = $1 AND active', [r.code]);
      await c.query('UPDATE source_versions SET active = true WHERE id = $1', [r.best_id]);
      await c.query('COMMIT');
      console.log(`  ✓ ${r.code}: re-activated version with ${r.best_recs} records (was 0)`);
      repaired++;
    } catch (e) {
      await c.query('ROLLBACK');
      console.error(`  ✗ ${r.code}: ${(e as Error).message}`);
    } finally {
      c.release();
    }
  }

  if (needsSync.length) {
    console.log(`\nNeed a real sync/import (no data in any local version):`);
    console.log('  ' + needsSync.map(r => r.code).join(', '));
  }
  console.log(`\nRepaired ${repaired}/${recoverable.length} recoverable sources.`);
  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });
