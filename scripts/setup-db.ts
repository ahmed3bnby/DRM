import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/lib/password';

if (process.env.APP_ENV !== 'local') throw new Error('Demo setup is local-only');
const databaseUrl = new URL(process.env.DATABASE_URL!);
// Seeding normally targets a local database. Set ALLOW_REMOTE_DB_SETUP=1 to seed
// a managed database (e.g. Neon) from your machine for a deployment.
const isLocalDb = ['127.0.0.1', 'localhost'].includes(databaseUrl.hostname);
if (!isLocalDb && process.env.ALLOW_REMOTE_DB_SETUP !== '1') throw new Error('Non-local database: set ALLOW_REMOTE_DB_SETUP=1 to seed it intentionally');
if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12) throw new Error('Set a demo password of at least 12 characters');
const adminUrl = process.env.DATABASE_ADMIN_URL!;
const adminRemote = !/@(localhost|127\.0\.0\.1)[:/]/.test(adminUrl);
const db = new Pool({connectionString: adminUrl, ...(adminRemote && !/sslmode=disable/.test(adminUrl) ? { ssl: { rejectUnauthorized: false } } : {})});
try {
  await db.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='mizan_app') THEN CREATE ROLE mizan_app LOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$");
  const formatted = await db.query("SELECT format('ALTER ROLE mizan_app PASSWORD %L', $1::text) AS sql", [decodeURIComponent(databaseUrl.password)]);
  await db.query(formatted.rows[0].sql);
  await db.query(await readFile('db/001_foundation.sql', 'utf8'));
  await db.query(await readFile('db/002_search.sql', 'utf8'));
  await db.query(await readFile('db/003_source_changes.sql', 'utf8'));
  await db.query(await readFile('db/005_customer_search.sql', 'utf8'));
  await db.query(await readFile('db/004_screening.sql', 'utf8'));
  await db.query(await readFile('db/005_match_decisions.sql', 'utf8'));
  await db.query(await readFile('db/006_screening_report.sql', 'utf8'));
  await db.query(await readFile('db/007_team_quota.sql', 'utf8'));
  await db.query(await readFile('db/008_user_controls.sql', 'utf8'));
  await db.query(await readFile('db/009_quota_anchor.sql', 'utf8'));
  await db.query(await readFile('db/010_customer_risk.sql', 'utf8'));
  await db.query(await readFile('db/011_adverse_media.sql', 'utf8'));
  await db.query(await readFile('db/012_username.sql', 'utf8'));
  await db.query(await readFile('db/013_review_cases.sql', 'utf8'));
  await db.query(await readFile('db/014_review_case_dedupe.sql', 'utf8'));
  await db.query(await readFile('db/015_phonetic.sql', 'utf8'));
  const organizations = [
    ['10000000-0000-4000-8000-000000000001', 'مكتب الأفق للمحاسبة', 'ORG-001'],
    ['10000000-0000-4000-8000-000000000002', 'مكتب البيان للتدقيق', 'ORG-002']
  ];
  const actors = [
    ['20000000-0000-4000-8000-000000000001', organizations[0][0], 'demo@mizan.test', 'سارة أحمد', 'admin'],
    ['20000000-0000-4000-8000-000000000002', organizations[1][0], 'second@mizan.test', 'عمر خالد', 'admin'],
    ['20000000-0000-4000-8000-000000000003', organizations[0][0], 'auditor@mizan.test', 'مراجع مستقل', 'viewer']
  ];
  for (const row of organizations) await db.query('INSERT INTO organizations(id,name,reference) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', row);
  for (const [id,org,email,name,role] of actors) {
    await db.query(`INSERT INTO users(id,organization_id,email,display_name,role,password_hash) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET password_hash=EXCLUDED.password_hash`, [id,org,email,name,role,hashPassword(process.env.DEMO_PASSWORD)]);
  }
  const rows = [
    ['شركة المدار للتوريدات', 'company', 'AE', 'التجارة العامة'], ['ريم سالم الكتبي', 'individual', 'AE', 'خدمات مهنية'],
    ['شركة النخبة للاستشارات', 'company', 'AE', 'الاستشارات'], ['يوسف حسن مراد', 'individual', 'EG', 'تقنية المعلومات'],
    ['شركة السواحل اللوجستية', 'company', 'AE', 'النقل والخدمات اللوجستية'], ['شركة واحة التقنية', 'company', 'SA', 'تقنية المعلومات'],
    ['ليلى مروان ناصر', 'individual', 'AE', 'خدمات مهنية'], ['شركة آفاق التصميم', 'company', 'AE', 'التصميم'],
    ['شركة ركن الإنشاءات', 'company', 'AE', 'المقاولات'], ['أحمد سامي حمدان', 'individual', 'GB', 'الاستشارات'],
    ['شركة نواة الأعمال', 'company', 'AE', 'خدمات الشركات'], ['منى عادل إبراهيم', 'individual', 'EG', 'خدمات مهنية']
  ];
  for (let i=0; i<rows.length; i++) {
    const [name,type,country,industry] = rows[i];
    const ref = `KYC-${String(1048-i).padStart(5,'0')}`;
    const inserted = await db.query(`INSERT INTO customers(id,organization_id,reference,name,entity_type,country,industry,status,notes,created_by,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ملف اصطناعي مخصص لتجربة النظام؛ لا يمثل عميلًا حقيقيًا',$9,now()-($10::int * interval '5 hours'))
      ON CONFLICT (organization_id,reference) DO NOTHING RETURNING id`,
      [randomUUID(), organizations[0][0],ref,name,type,country,industry,i<4?'awaiting_information':'draft',actors[0][0],i]);
    if (inserted.rowCount) await db.query(`INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary,created_at)
      VALUES ($1,$2,$3,'customer.created',$4,now()-($5::int * interval '5 hours'))`,
      [organizations[0][0],actors[0][0],inserted.rows[0].id,`أُضيف ملف تجريبي: ${name}`,i]);
  }
  await db.query(`INSERT INTO customers(organization_id,reference,name,entity_type,country,industry,created_by)
    VALUES ($1,'KYC-B0001','شركة البيان التجريبية الخاصة','company','AE','التدقيق',$2) ON CONFLICT DO NOTHING`,[organizations[1][0],actors[1][0]]);
  console.log('Schema and synthetic fixtures ready. 2 organizations; no real customer identities.');
} finally { await db.end(); }
