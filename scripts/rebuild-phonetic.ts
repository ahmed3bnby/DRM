// Recompute source_names.phonetic with the current phoneticKey().
// Run after any change to src/lib/name-normalization.ts phoneticKey, and to repair names that
// were imported before the phonetic column existed (NULL keys). Idempotent: only rows whose key
// differs are written. Usage: npm run sources:rebuild-phonetic [-- --nulls-only]
import {Pool} from 'pg';
import {phoneticKey} from '../src/lib/name-normalization';

const url = process.env.DATABASE_ADMIN_URL!;
const ssl = !/@(localhost|127\.0\.0\.1)[:/]/.test(url) && !/sslmode=disable/.test(url);
const db = new Pool({connectionString: url, ...(ssl ? {ssl: {rejectUnauthorized: false}} : {})});
const nullsOnly = process.argv.includes('--nulls-only');
const BATCH = 5000;

const main = async () => {
  let lastRecord = '00000000-0000-0000-0000-000000000000', lastName = '', scanned = 0, changed = 0;
  const started = Date.now();
  for (;;) {
    const rows = (await db.query(
      `SELECT record_id, name, phonetic FROM source_names
       WHERE (record_id, name) > ($1::uuid, $2) ${nullsOnly ? 'AND phonetic IS NULL' : ''}
       ORDER BY record_id, name LIMIT ${BATCH}`, [lastRecord, lastName])).rows as {record_id:string; name:string; phonetic:string|null}[];
    if (!rows.length) break;
    scanned += rows.length;
    lastRecord = rows[rows.length - 1].record_id; lastName = rows[rows.length - 1].name;
    const updates = rows.map(r => ({record_id: r.record_id, name: r.name, phonetic: phoneticKey(r.name)}))
      .filter((u, i) => u.phonetic !== rows[i].phonetic);
    if (updates.length) {
      await db.query(`UPDATE source_names n SET phonetic = x.phonetic
        FROM jsonb_to_recordset($1::jsonb) AS x(record_id uuid, name text, phonetic text)
        WHERE n.record_id = x.record_id AND n.name = x.name`, [JSON.stringify(updates)]);
      changed += updates.length;
    }
    if (scanned % 50000 < BATCH) console.log(`  ${scanned} scanned · ${changed} updated`);
  }
  console.log(`rebuild-phonetic: ${scanned} names scanned, ${changed} updated in ${((Date.now() - started) / 1000).toFixed(1)}s`);
};
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.end());
