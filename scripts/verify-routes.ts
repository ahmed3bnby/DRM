import { Pool } from 'pg';
import crypto from 'node:crypto';

async function verifyAll() {
  const pool = new Pool({ connectionString: 'postgresql://ahmed:a7b6f00b2bf43d059e1bf7636852dfd80558aa155a654e56@127.0.0.1:55432/mizan' });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = (await pool.query("SELECT id FROM users WHERE email='demo@mizan.test' LIMIT 1")).rows[0];

  await pool.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
    [user.id, tokenHash]
  );
  console.log('Created active test session for user:', user.id);

  const urls = [
    'http://localhost:3001/profiles/KYC-1F74DA96',
    'http://localhost:3001/profiles/KYC-1F74DA96/report',
    'http://localhost:3001/profiles/KYC-1F74DA96/sar',
    'http://localhost:3001/profiles/KYC-1F74DA96/sar?type=REAR',
    'http://localhost:3001/profiles/KYC-1F74DA96/sar?type=FARI',
    'http://localhost:3001/profiles/KYC-1F74DA96/monitoring-audit',
    'http://localhost:3001/search?q=Lana',
    'http://localhost:3001/search?q=9256860',
    'http://localhost:3001/search?q=Gulf+Capital',
    'http://localhost:3001/search?q=Mossack+Fonseca',
    'http://localhost:3001/sources'
  ];

  let anyError = false;
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: {
          'Cookie': 'mizan_session=' + rawToken,
          'Accept': 'text/html'
        }
      });
      const html = await res.text();
      const hasNextError = res.status !== 200 || html.includes('Application error') || html.includes('Server Error') || html.includes('unhandledRejection');
      console.log(u, '-> Status:', res.status, 'HTML bytes:', html.length, hasNextError ? '❌ HAS ERROR' : '✓ OK');
      if (hasNextError) {
        anyError = true;
        console.error('Error sample:', html.slice(0, 400));
      }
    } catch (e: any) {
      anyError = true;
      console.error(u, '-> Fetch failed:', e.message);
    }
  }

  // Cleanup test session
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  await pool.end();

  if (anyError) {
    console.error('Verification finished with errors!');
    process.exit(1);
  } else {
    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  }
}

verifyAll().catch(err => {
  console.error(err);
  process.exit(1);
});
