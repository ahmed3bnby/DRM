import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { createSession, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES } from '../src/lib/auth';
import { pool } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

const testEmail = 'test-lockout@drm.test';
const testPassword = 'CorrectPassword123!';
const testEmailKey = digest(testEmail);
const adminPool = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

beforeEach(async () => {
  await adminPool.query('DELETE FROM login_attempts WHERE email_key = $1', [testEmailKey]);
  await adminPool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  await adminPool.query(
    `INSERT INTO users (id, organization_id, email, display_name, password_hash, role)
     VALUES (gen_random_uuid(), '10000000-0000-4000-8000-000000000001', $1, 'Test User', $2, 'analyst')`,
    [testEmail, hashPassword(testPassword)]
  );
});

after(async () => {
  await adminPool.query('DELETE FROM login_attempts WHERE email_key = $1', [testEmailKey]);
  await adminPool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  await Promise.all([pool.end(), adminPool.end()]);
});

test('login rate limit: failed attempts decrement remaining attempts and trigger 15-min lockout at 5', async () => {
  // Attempt 1: Wrong password -> 4 attempts remaining
  const res1 = await createSession(testEmail, 'wrong-1');
  assert.equal(res1.success, false);
  if (!res1.success) {
    assert.equal(res1.reason, 'invalid');
    assert.equal(res1.remainingAttempts, 4);
    assert.equal(res1.maxAttempts, 5);
  }

  // Attempt 2: Wrong password -> 3 attempts remaining
  const res2 = await createSession(testEmail, 'wrong-2');
  assert.equal(res2.success, false);
  if (!res2.success) {
    assert.equal(res2.reason, 'invalid');
    assert.equal(res2.remainingAttempts, 3);
  }

  // Attempt 3: Wrong password -> 2 attempts remaining
  const res3 = await createSession(testEmail, 'wrong-3');
  assert.equal(res3.success, false);
  if (!res3.success) {
    assert.equal(res3.reason, 'invalid');
    assert.equal(res3.remainingAttempts, 2);
  }

  // Attempt 4: Wrong password -> 1 attempt remaining
  const res4 = await createSession(testEmail, 'wrong-4');
  assert.equal(res4.success, false);
  if (!res4.success) {
    assert.equal(res4.reason, 'invalid');
    assert.equal(res4.remainingAttempts, 1);
  }

  // Attempt 5: Wrong password -> 5th failure triggers immediate rate_limited lockout
  const res5 = await createSession(testEmail, 'wrong-5');
  assert.equal(res5.success, false);
  if (!res5.success) {
    assert.equal(res5.reason, 'rate_limited');
    assert.ok((res5.retryAfterMinutes ?? 0) > 0);
  }

  // Attempt 6 (Locked): Even entering the CORRECT password must be rejected during lockout
  const res6 = await createSession(testEmail, testPassword);
  assert.equal(res6.success, false);
  if (!res6.success) {
    assert.equal(res6.reason, 'rate_limited');
    assert.ok((res6.retryAfterMinutes ?? 0) > 0);
  }
});

test('login rate limit: successful login resets failed attempts', async () => {
  // 2 failed attempts
  await createSession(testEmail, 'wrong-pass');
  await createSession(testEmail, 'wrong-pass-2');

  const countBefore = await pool.query('SELECT count(*)::int AS c FROM login_attempts WHERE email_key = $1', [testEmailKey]);
  assert.equal(countBefore.rows[0].c, 2);

  // Successful login with correct password
  const successRes = await createSession(testEmail, testPassword);
  assert.equal(successRes.success, true);

  // Failed attempts must be cleared from the database
  const countAfter = await pool.query('SELECT count(*)::int AS c FROM login_attempts WHERE email_key = $1', [testEmailKey]);
  assert.equal(countAfter.rows[0].c, 0);
});

test('loginAction: returns informative countdown and lockout error messages', async () => {
  const { loginAction } = await import('../src/app/actions');

  // Attempt 1 with wrong password -> should mention 4 attempts remaining
  const fd1 = new FormData();
  fd1.set('email', testEmail);
  fd1.set('password', 'wrong-pass');
  const res1 = await loginAction({}, fd1);
  assert.ok(
    res1.error?.includes('متبقي لك 4 محاولات') || res1.error?.includes('4 attempts remaining'),
    `Expected countdown message, got: ${res1.error}`
  );

  // 3 more failed attempts
  for (let i = 0; i < 3; i++) {
    const fd = new FormData();
    fd.set('email', testEmail);
    fd.set('password', `wrong-pass-${i}`);
    await loginAction({}, fd);
  }

  // Attempt 5 -> triggers lockout
  const fd5 = new FormData();
  fd5.set('email', testEmail);
  fd5.set('password', 'wrong-pass-5');
  const res5 = await loginAction({}, fd5);
  assert.ok(
    res5.error?.includes('تم حظر محاولات الدخول مؤقتاً') || res5.error?.includes('Too many failed login attempts'),
    `Expected lockout message, got: ${res5.error}`
  );
});

