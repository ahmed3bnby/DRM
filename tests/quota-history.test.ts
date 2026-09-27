import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/lib/db';
import {
  consumeSearch,
  setUserQuota,
  createTeamUser,
} from '../src/lib/team';
import {
  getPlatformChecksSummary,
  listAllAccountsQuota,
  listQuotaHistory,
  superAdminCreditUserQuota,
} from '../src/lib/platform';

const org = '10000000-0000-4000-8000-000000000001';
const adminActor = {
  id: '20000000-0000-4000-8000-000000000001',
  organizationId: org,
  role: 'admin' as const,
  displayName: 'سارة أحمد',
  email: 'demo@mizan.test',
};

// Super admin actor
const superAdminActor = {
  id: 'e5d93a91-f57f-49df-9b10-a9fdde72567d',
  email: 'ahmed3bnbyy@gmail.com',
  displayName: 'Ahmed (Super Admin)',
  role: 'admin' as const,
};

const dbAdmin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

const testUserId = randomUUID();
const testUserEmail = `history-test-${Date.now()}@mizan.test`;

before(async () => {
  // Ensure adminActor exists
  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota, quota_anchor)
    VALUES ($1, $2, 'admin-demo', $3, $4, 'admin', 'hash', null, 0)
    ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
  `, [adminActor.id, org, adminActor.email, adminActor.displayName]);

  // Ensure super admin exists
  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota, quota_anchor)
    VALUES ($1, $2, 'super-admin', $3, $4, 'admin', 'hash', null, 0)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  `, [superAdminActor.id, org, superAdminActor.email, superAdminActor.displayName]);

  // Insert a test user with initial quota = 10
  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota, quota_anchor)
    VALUES ($1, $2, $3, $4, $5, 'analyst', 'hash', 10, 0)
    ON CONFLICT (id) DO NOTHING
  `, [testUserId, org, `test-hist-${Date.now()}`, testUserEmail, 'History Test Analyst']);
});

after(async () => {
  await dbAdmin.query('DELETE FROM quota_history WHERE user_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM search_events WHERE user_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM audit_events WHERE actor_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await dbAdmin.end();
  await pool.end();
});

test('Super Admin can credit checks (+50) to a user account and it logs in quota_history', async () => {
  const result = await superAdminCreditUserQuota(superAdminActor, testUserId, {
    mode: 'add',
    amount: 50,
    note: 'شحن رصيد إضافي للتجربة',
  });

  assert.equal(result.success, true);
  assert.equal(result.newQuota, 60); // 10 + 50
  assert.equal(result.delta, 50);

  // Verify in quota_history
  const history = await listQuotaHistory(20);
  const entry = history.find((h) => h.userId === testUserId);
  assert.ok(entry, 'Should find quota history entry for user');
  assert.equal(entry.delta, 50);
  assert.equal(entry.previousQuota, 10);
  assert.equal(entry.newQuota, 60);
  assert.equal(entry.actionType, 'quota_credited');
  assert.equal(entry.note, 'شحن رصيد إضافي للتجربة');
  assert.ok(entry.actorName.includes('Super Admin'), 'Actor name should record Super Admin');
});

test('Super Admin can set exact quota limit with anchor reset', async () => {
  const result = await superAdminCreditUserQuota(superAdminActor, testUserId, {
    mode: 'set',
    amount: 100,
    resetAnchor: true,
    note: 'تعيين سقف 100 تشييكة',
  });

  assert.equal(result.success, true);
  assert.equal(result.newQuota, 100);
  assert.equal(result.delta, 40); // 100 - 60

  const history = await listQuotaHistory(20);
  const entry = history.find((h) => h.userId === testUserId && h.newQuota === 100);
  assert.ok(entry);
  assert.equal(entry.actionType, 'quota_updated');
  assert.equal(entry.previousQuota, 60);
  assert.equal(entry.newQuota, 100);
});

test('Tenant Admin modifying quota with setUserQuota creates an audit record', async () => {
  await setUserQuota(adminActor, testUserId, 150);

  const history = await listQuotaHistory(20);
  const entry = history.find((h) => h.userId === testUserId && h.newQuota === 150);
  assert.ok(entry, 'Should find setUserQuota history entry');
  assert.equal(entry.previousQuota, 100);
  assert.equal(entry.newQuota, 150);
  assert.equal(entry.delta, 50);
  assert.equal(entry.actionType, 'quota_updated');
});

test('Platform Checks Summary accurately reflects platform-wide checks and active accounts', async () => {
  // Let user perform 2 searches
  const testActor = { id: testUserId, organizationId: org };
  await consumeSearch(testActor, `query:hist-alpha-${Date.now()}`);
  await consumeSearch(testActor, `query:hist-beta-${Date.now()}`);

  const summary = await getPlatformChecksSummary();
  assert.ok(summary.totalChecks >= 2, 'Total checks should be at least 2');
  assert.ok(summary.todayChecks >= 2, 'Today checks should include the 2 just performed');
  assert.ok(summary.activeAccounts >= 1, 'Active accounts count should include our user');
  assert.ok(summary.totalAllocatedQuota > 0, 'Allocated quota should be greater than 0');
});

test('listAllAccountsQuota reports allocated checks, consumed checks, and remaining balance accurately', async () => {
  const accounts = await listAllAccountsQuota();
  const acc = accounts.find((a) => a.id === testUserId);
  assert.ok(acc, 'Should find user in accounts quota list');

  assert.equal(acc.searchQuota, 150);
  assert.ok(acc.lifetimeChecks >= 2);
  assert.ok(acc.usedInCycle >= 0);
  assert.ok(acc.remaining !== null && acc.remaining <= 150);
  assert.ok(acc.lastCheckAt !== null, 'Last check date should be recorded');
  assert.ok(acc.lastCreditAt !== null, 'Last credit date should be recorded');
  assert.equal(acc.lastCreditDelta, 50); // From setUserQuota (100 -> 150)
});
