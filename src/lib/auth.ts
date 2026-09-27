import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool } from './db';
import { verifyPassword } from './password';

import { isSuperAdminEmail, isSuperAdminId } from './platform-access';
import { getSystemLockdown } from './platform';

export type Actor = { id: string; organizationId: string; organizationName: string; displayName: string; email: string; role: string; plan?: string; features?: Record<string, boolean>; memberLimit?: number };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = 'mizan_session';

export async function assertLocalRuntime() {
  try {
    const host = (await headers()).get('host');
    if (!host) {
      throw new Error('Missing or invalid host header.');
    }
    if (process.env.APP_RESTRICT_LOCALHOST === 'true' && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
      throw new Error('Workspace access is restricted to authorized host.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('outside a request scope')) {
      return;
    }
    throw err;
  }
}
export async function currentActor(): Promise<Actor | null> {
  await assertLocalRuntime();
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await pool.query(`SELECT u.id, u.organization_id AS "organizationId", o.name AS "organizationName",
    o.plan, o.features, o.member_limit AS "memberLimit",
    u.display_name AS "displayName", u.email, u.role FROM sessions s
    JOIN users u ON u.id=s.user_id JOIN organizations o ON o.id=u.organization_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL`, [digest(token)]);
  const actor = result.rows[0] ?? null;
  if (!actor) return null;

  // If system lockdown is active, only Super Admin can access the system!
  if (!isSuperAdminEmail(actor.email) && !isSuperAdminId(actor.id)) {
    const lockdown = await getSystemLockdown();
    if (lockdown.enabled) {
      return null;
    }
  }

  return actor;
}
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  return actor;
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export type SessionResult =
  | { success: true }
  | {
      success: false;
      reason: 'maintenance' | 'rate_limited' | 'invalid';
      remainingAttempts?: number;
      retryAfterMinutes?: number;
      maxAttempts?: number;
    };

export async function createSession(email: string, password: string, remember = false): Promise<SessionResult> {
  await assertLocalRuntime();
  if (email.length > 254 || password.length > 200) return { success: false, reason: 'invalid' };

  const cleanEmail = email.toLowerCase().trim();
  const isSuperAdmin = isSuperAdminEmail(cleanEmail);

  // If system is disabled/in maintenance, only Super Admin can log in!
  if (!isSuperAdmin) {
    const lockdown = await getSystemLockdown();
    if (lockdown.enabled) {
      return { success: false, reason: 'maintenance' };
    }
  }

  const key = digest(cleanEmail);

  // 1. Check existing failed attempts within the 15-minute window
  const attemptRes = await pool.query(
    `SELECT 
       count(*)::int AS count,
       extract(epoch from (min(created_at) + ($2 * interval '1 minute') - now()))::int AS seconds_left
     FROM login_attempts 
     WHERE email_key = $1 AND created_at > now() - ($2 * interval '1 minute')`,
    [key, LOCKOUT_MINUTES]
  );

  const failedCount = Number(attemptRes.rows[0]?.count ?? 0);
  const secondsLeft = Number(attemptRes.rows[0]?.seconds_left ?? 0);
  const retryAfterMinutes = Math.max(1, Math.ceil(secondsLeft / 60));

  // If already locked out (>= 5 failed attempts in the last 15 mins), reject immediately
  if (failedCount >= MAX_LOGIN_ATTEMPTS) {
    return {
      success: false,
      reason: 'rate_limited',
      retryAfterMinutes,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  // 2. Fetch user and verify password
  const users = await pool.query(
    'SELECT id, password_hash FROM users WHERE email=$1 AND disabled_at IS NULL',
    [cleanEmail]
  );
  const user = users.rows[0];
  const dummy = '0'.repeat(32) + ':' + '0'.repeat(128);
  const passwordMatch = user && verifyPassword(password, user.password_hash);

  if (!passwordMatch) {
    // Record this failed attempt
    await pool.query('INSERT INTO login_attempts(email_key) VALUES ($1)', [key]);
    const newCount = failedCount + 1;
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - newCount);

    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      return {
        success: false,
        reason: 'rate_limited',
        retryAfterMinutes: LOCKOUT_MINUTES,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
      };
    }

    return {
      success: false,
      reason: 'invalid',
      remainingAttempts: remaining,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  // 3. Authentication successful! Clear previous failed attempts
  try {
    await pool.query('DELETE FROM login_attempts WHERE email_key=$1', [key]);
  } catch (err) {
    console.error('Failed to clear login attempts:', err);
  }

  // 4. Create session and set cookie
  try {
    const jar = await cookies();
    const old = jar.get(cookieName)?.value;
    if (old) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [digest(old)]);
    const token = randomBytes(32).toString('hex');
    const lifetime = remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+($3 * interval '1 second'))",
      [digest(token), user.id, lifetime]
    );
    jar.set(cookieName, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.APP_ORIGIN?.startsWith('https:') ?? false,
      path: '/',
      maxAge: lifetime,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('outside a request scope')) {
      const token = randomBytes(32).toString('hex');
      const lifetime = remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
      await pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+($3 * interval '1 second'))",
        [digest(token), user.id, lifetime]
      );
    } else {
      throw err;
    }
  }
  return { success: true };
}
export async function destroySession() {
  await assertLocalRuntime();
  try {
    const jar = await cookies();
    const token = jar.get(cookieName)?.value;
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
    jar.delete(cookieName);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('outside a request scope')) {
      return;
    }
    throw err;
  }
}
