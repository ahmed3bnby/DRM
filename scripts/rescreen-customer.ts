import { runAndSaveScreening } from '../src/lib/screening';
import { Pool } from 'pg';

async function rescreen() {
  const pool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const cust = (await pool.query("SELECT id FROM customers WHERE reference='KYC-1F74DA96'")).rows[0];
  const user = (await pool.query("SELECT id, organization_id, role FROM users WHERE email='demo@mizan.test'")).rows[0];

  console.log('Re-screening KYC-1F74DA96...');
  await runAndSaveScreening({
    id: user.id,
    organizationId: user.organization_id,
    role: user.role,
    plan: 'enterprise',
    features: {
      adverse_media: true,
      company_search: true,
      reviews: true,
      regional_sources: true,
      enforcement_debarment: true,
      pep_screening: true
    }
  }, cust.id);

  const check = (await pool.query("SELECT adverse_media FROM customer_screenings WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 1", [cust.id])).rows[0];
  console.log('Updated adverse_media count:', check.adverse_media.count);
  console.log('Updated adverse_media articles:', check.adverse_media.articles.length);
  console.log('Updated adverse_media generalNews:', check.adverse_media.generalNews.length);
  console.log('First article title:', check.adverse_media.articles[0]?.title);
  console.log('First article snippet:', check.adverse_media.articles[0]?.snippet);
  await pool.end();
}

rescreen().catch(err => {
  console.error('Rescreen failed:', err);
  process.exit(1);
});
