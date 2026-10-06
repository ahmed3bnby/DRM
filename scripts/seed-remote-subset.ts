// Copy a SUBSET of the watchlists (plus the super-admin account and the demo org's settings)
// from the local database into a remote one — e.g. a free Neon database behind a Vercel demo.
// The full dataset is ~1.2 GB; this core set fits comfortably in Neon's free 0.5 GB.
//
// Usage (after `npm run db:setup` has created the schema on the target):
//   TARGET_ADMIN_URL='postgres://owner:…@…neon.tech/neondb?sslmode=require' \
//     node --env-file=.env.local --import tsx scripts/seed-remote-subset.ts [--lists=code1,code2]
import {Pool} from 'pg';

const DEFAULT_LISTS = [
  // Core sanctions
  'un_sc_sanctions', 'us_ofac_sdn', 'us_ofac_cons', 'gb_fcdo_sanctions', 'eu_fsf',
  // UAE & GCC / regional
  'ae_local_terrorists', 'ae_local_terror_list', 'ae_dfsa_prohibited', 'ae_dfsa_adgm_alerts', 'ae_sca_alerts',
  'sa_pcct_terrorism_list', 'sa_cma_alerts', 'eg_terrorists', 'eg_terror_list', 'eg_house_representatives',
  'qa_shura_council', 'bh_nuwab', 'om_parliament', 'ir_sanctions',
  // PEP
  'us_cia_world_leaders',
  // Wanted / law enforcement
  'interpol_red_notices', 'us_fbi_most_wanted', 'eu_europol_wanted', 'gb_nca_most_wanted', 'nz_designated_terrorists',
  // Debarment / export control / registries
  'worldbank_debarred', 'afdb_sanctions', 'iadb_sanctions', 'ebrd_ineligible', 'us_bis_denied',
  'ofac_sanctioned_vessels', 'gleif_lei_registry', 'opencorporates_registry', 'icij_offshore_leaks', 'gb_fca_warnings',
];
const SUPER_ADMIN_EMAIL = 'ahmed3bnbyy@gmail.com';
const DEMO_ORG = '10000000-0000-4000-8000-000000000001';

const target = process.env.TARGET_ADMIN_URL;
if (!target) throw new Error('Set TARGET_ADMIN_URL to the remote database owner connection string');
if (/@(localhost|127\.0\.0\.1)[:/]/.test(target) && !process.env.ALLOW_LOCAL_TARGET) throw new Error('TARGET_ADMIN_URL points at localhost — refusing (set ALLOW_LOCAL_TARGET=1 for a dry run)');
const arg = process.argv.find(a => a.startsWith('--lists='));
const lists = arg ? arg.slice(8).split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_LISTS;

const ssl = (url: string) => !/@(localhost|127\.0\.0\.1)[:/]/.test(url) && !/sslmode=disable/.test(url) ? {ssl: {rejectUnauthorized: false}} : {};
const src = new Pool({connectionString: process.env.DATABASE_ADMIN_URL});
const dst = new Pool({connectionString: target, ...ssl(target), max: 4});

async function copyRows(table: string, rows: Record<string, unknown>[], conflict = 'DO NOTHING') {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  // jsonb_populate_recordset keeps every column's real type (uuid, jsonb, timestamptz…)
  await dst.query(`INSERT INTO ${table} (${cols.join(',')})
    SELECT ${cols.join(',')} FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb) ON CONFLICT ${conflict}`, [JSON.stringify(rows)]);
}

const main = async () => {
  const started = Date.now();
  const versions = (await src.query(`SELECT * FROM source_versions WHERE active AND code = ANY($1)`, [lists])).rows;
  const missing = lists.filter(c => !versions.some(v => v.code === c));
  if (missing.length) console.log(`not loaded locally (skipped): ${missing.join(', ')}`);

  for (const v of versions) {
    const t = Date.now();
    // Retire whatever version of this list the target had, then insert ours as the active one.
    await dst.query(`UPDATE source_versions SET active=false WHERE code=$1 AND id<>$2`, [v.code, v.id]);
    await copyRows('source_versions', [v], '(id) DO UPDATE SET active=true');
    let records = 0, names = 0, after = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const batch = (await src.query(`SELECT * FROM source_records WHERE version_id=$1 AND id>$2 ORDER BY id LIMIT 1000`, [v.id, after])).rows;
      if (!batch.length) break;
      after = batch[batch.length - 1].id;
      await copyRows('source_records', batch);
      const nm = (await src.query(`SELECT * FROM source_names WHERE record_id = ANY($1::uuid[])`, [batch.map(r => r.id)])).rows;
      for (let i = 0; i < nm.length; i += 2000) await copyRows('source_names', nm.slice(i, i + 2000));
      records += batch.length; names += nm.length;
    }
    const imports = (await src.query(`SELECT * FROM source_imports WHERE version_id=$1`, [v.id])).rows;
    await copyRows('source_imports', imports);
    console.log(`  ${v.code.padEnd(26)} ${String(records).padStart(6)} records · ${String(names).padStart(6)} names · ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }

  // Demo org: copy its full settings (plan, enabled features, report branding) over setup-db's defaults.
  const org = (await src.query(`SELECT name, reference, plan, features, member_limit FROM organizations WHERE id=$1`, [DEMO_ORG])).rows[0];
  if (org) await dst.query(`UPDATE organizations SET name=$2, reference=$3, plan=$4, features=$5, member_limit=$6 WHERE id=$1`,
    [DEMO_ORG, org.name, org.reference, org.plan, org.features, org.member_limit]);

  // Super-admin account (same password as locally). Platform-owner rights come from the email.
  const owner = (await src.query(`SELECT * FROM users WHERE email=$1`, [SUPER_ADMIN_EMAIL])).rows[0];
  if (owner) {
    const orgExists = (await dst.query(`SELECT 1 FROM organizations WHERE id=$1`, [owner.organization_id])).rowCount;
    if (!orgExists) owner.organization_id = DEMO_ORG;
    await copyRows('users', [owner], '(id) DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role');
  }

  const size = (await dst.query(`SELECT pg_size_pretty(pg_database_size(current_database())) s`)).rows[0].s;
  const active = (await dst.query(`SELECT count(*)::int n, sum(record_count)::int r FROM source_versions WHERE active`)).rows[0];
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s — ${active.n} active lists, ${active.r} records, database size ${size}`);
};
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await src.end(); await dst.end(); });
