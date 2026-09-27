import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { pool, withTenant } from '../src/lib/db';
import { consumeSearch, quotaStatus, setUserQuota, createTeamUser } from '../src/lib/team';
import { randomUUID } from 'node:crypto';

const org = '10000000-0000-4000-8000-000000000001';
const adminActor = { id: '20000000-0000-4000-8000-000000000001', organizationId: org, role: 'admin' as const };
const dbAdmin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

const testUserId = randomUUID();
const testActor = { id: testUserId, organizationId: org, role: 'analyst' as const };

before(async () => {
  // Ensure adminActor exists for audit_events FK constraint
  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota, quota_anchor)
    VALUES ($1, $2, 'admin-demo', 'demo@mizan.test', 'Admin User', 'admin', 'hash', null, 0)
    ON CONFLICT (id) DO NOTHING
  `, [adminActor.id, org]);

  // Create a dedicated test user with quota = 3
  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota, quota_anchor)
    VALUES ($1, $2, $3, $4, $5, 'analyst', 'hash', 3, 0)
    ON CONFLICT (id) DO NOTHING
  `, [testUserId, org, `test-quota-${Date.now()}`, `test-quota-${Date.now()}@mizan.test`, 'Test Quota User']);
});

after(async () => {
  await dbAdmin.query('DELETE FROM search_events WHERE user_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM audit_events WHERE actor_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await dbAdmin.end();
  await pool.end();
});

test('Admin has unlimited quota (allowed = true, remaining = null)', async () => {
  const status = await quotaStatus(adminActor);
  assert.equal(status.allowed, true);
  assert.equal(status.remaining, null);
  assert.equal(status.quota, null);
});

test('Analyst consumes search quota accurately up to limit', async () => {
  // Query 1
  const q1 = await consumeSearch(testActor, 'query:customer-alpha');
  assert.equal(q1.allowed, true);
  assert.equal(q1.remaining, 2);
  assert.equal(q1.used, 1);

  // Query 2
  const q2 = await consumeSearch(testActor, 'query:customer-beta');
  assert.equal(q2.allowed, true);
  assert.equal(q2.remaining, 1);
  assert.equal(q2.used, 2);

  // Query 3
  const q3 = await consumeSearch(testActor, 'query:customer-gamma');
  assert.equal(q3.allowed, true);
  assert.equal(q3.remaining, 0);
  assert.equal(q3.used, 3);

  // Query 4: should be blocked
  const q4 = await consumeSearch(testActor, 'query:customer-delta');
  assert.equal(q4.allowed, false);
  assert.equal(q4.remaining, 0);
  assert.equal(q4.used, 3);
});

test('Repeated search for identical key is deduped and does not double-charge', async () => {
  // Searching query:customer-alpha again should not consume extra quota
  const repeat = await consumeSearch(testActor, 'query:customer-alpha');
  assert.equal(repeat.used, 3);
  assert.equal(repeat.remaining, 0);
});

test('Admin can renew user quota with setUserQuota', async () => {
  // Set new quota to 5 searches from now
  await setUserQuota(adminActor, testUserId, 5);

  const status = await quotaStatus(testActor);
  assert.equal(status.allowed, true);
  assert.equal(status.quota, 5);
  assert.equal(status.used, 0);
  assert.equal(status.remaining, 5);

  // Now user can search again
  const nextSearch = await consumeSearch(testActor, 'query:new-allowed-search');
  assert.equal(nextSearch.allowed, true);
  assert.equal(nextSearch.remaining, 4);
});

test('Database rejects negative quota via check constraint', async () => {
  await assert.rejects(
    dbAdmin.query('UPDATE users SET search_quota = -10 WHERE id = $1', [testUserId]),
    /users_search_quota_check/
  );
});
