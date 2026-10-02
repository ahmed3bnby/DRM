// @ts-nocheck
import { chromium } from '/Users/ahmed/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { Pool } from 'pg';
import crypto from 'node:crypto';

async function capture() {
  const pool = new Pool({ connectionString: 'postgresql://ahmed:a7b6f00b2bf43d059e1bf7636852dfd80558aa155a654e56@127.0.0.1:55432/mizan' });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = (await pool.query("SELECT id FROM users WHERE email='demo@mizan.test' LIMIT 1")).rows[0];

  await pool.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
    [user.id, tokenHash]
  );

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{
    name: 'mizan_session',
    value: rawToken,
    domain: 'localhost',
    path: '/'
  }]);

  const page = await context.newPage();
  console.log('Navigating to KYC-1F74DA96...');
  await page.goto('http://localhost:3001/profiles/KYC-1F74DA96');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '.local/kyc_profile_rendered.png', fullPage: true });
  console.log('Saved .local/kyc_profile_rendered.png');

  console.log('Navigating to KYC-1F74DA96 report...');
  await page.goto('http://localhost:3001/profiles/KYC-1F74DA96/report');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '.local/kyc_report_rendered.png', fullPage: true });
  console.log('Saved .local/kyc_report_rendered.png');

  console.log('Navigating to /analytics...');
  await page.goto('http://localhost:3001/analytics');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '.local/analytics_dashboard_rendered.png', fullPage: true });
  console.log('Saved .local/analytics_dashboard_rendered.png');

  console.log('Navigating to /team...');
  await page.goto('http://localhost:3001/team');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '.local/team_branding_rendered.png', fullPage: true });
  console.log('Saved .local/team_branding_rendered.png');

  await browser.close();
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  await pool.end();
  console.log('Capture completed successfully!');
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
