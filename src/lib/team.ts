import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withTenant } from './db';
import { hashPassword } from './password';
import { teamUserSchema } from './validation';
import { platformOwnerIds, platformOwnerEmails, isSuperAdminEmail, isSuperAdminId } from './platform-access';
import type { Actor } from './auth';

export type TeamMember = { id: string; username: string; email: string; display_name: string; role: string; search_quota: number | null; used: number; quota_anchor: number; disabled_at: Date | null };
export type TeamProfile = TeamMember & { searches: number; actions: number; customers: number };
export type UsageEvent = { id: string; query_key: string; created_at: Date; customer_id: string | null; customer_name: string | null; customer_ref: string | null };
export type ActionEvent = { id: string; action: string; summary: string; created_at: Date; customer_id: string | null; customer_ref: string | null };

function getPlatformOwnerFilters() {
  const hiddenEmails = platformOwnerEmails().map(e => e.toLowerCase());
  const hiddenIds = platformOwnerIds();
  return { hiddenEmails, hiddenIds };
}

async function assertNotSuperAdmin(db: PoolClient, userId: string) {
  const { hiddenEmails, hiddenIds } = getPlatformOwnerFilters();
  if (hiddenIds.includes(userId)) throw new Error('FORBIDDEN');
  const res = await db.query('SELECT email FROM users WHERE id=$1', [userId]);
  if (res.rowCount && isSuperAdminEmail(res.rows[0].email)) {
    throw new Error('FORBIDDEN');
  }
}

export async function listTeam(organizationId: string): Promise<TeamMember[]> {
  const { hiddenEmails, hiddenIds } = getPlatformOwnerFilters();
  return withTenant(organizationId, async db => {
    const r = await db.query(`SELECT u.id,
      COALESCE(NULLIF(u.username, ''), split_part(u.email, '@', 1), u.id::text) AS username,
      u.email,u.display_name,u.role,u.search_quota,u.quota_anchor,u.disabled_at,
      (SELECT count(*)::int FROM search_events e WHERE e.user_id=u.id) AS used
      FROM users u 
      WHERE u.organization_id=$1 
        AND NOT (lower(u.email) = ANY($2::text[]))
        AND NOT (u.id = ANY($3::uuid[]))
      ORDER BY (u.disabled_at IS NOT NULL), u.role, u.display_name`, [organizationId, hiddenEmails, hiddenIds]);
    return r.rows as TeamMember[];
  });
}

const MEMBER_COLS = `u.id,
  COALESCE(NULLIF(u.username, ''), split_part(u.email, '@', 1), u.id::text) AS username,
  u.email,u.display_name,u.role,u.search_quota,u.quota_anchor,u.disabled_at,
  (SELECT count(*)::int FROM search_events e WHERE e.user_id=u.id) AS used,
  (SELECT count(*)::int FROM search_events e WHERE e.user_id=u.id) AS searches,
  (SELECT count(*)::int FROM audit_events a WHERE a.actor_id=u.id) AS actions,
  (SELECT count(*)::int FROM customers c WHERE c.created_by=u.id) AS customers`;
export async function getTeamMember(organizationId: string, userId: string): Promise<TeamProfile | null> {
  const { hiddenEmails, hiddenIds } = getPlatformOwnerFilters();
  return withTenant(organizationId, async db => {
    const r = await db.query(
      `SELECT ${MEMBER_COLS} FROM users u 
       WHERE u.id=$1 AND u.organization_id=$2
         AND NOT (lower(u.email) = ANY($3::text[]))
         AND NOT (u.id = ANY($4::uuid[]))`,
      [userId, organizationId, hiddenEmails, hiddenIds]
    );
    return (r.rows[0] as TeamProfile | undefined) ?? null;
  });
}
// Resolve a member by their readable per-org username, email prefix, email or UUID.
export async function getTeamMemberByUsername(organizationId: string, identifier: string): Promise<TeamProfile | null> {
  const { hiddenEmails, hiddenIds } = getPlatformOwnerFilters();
  return withTenant(organizationId, async db => {
    const clean = (identifier || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    const r = await db.query(
      `SELECT ${MEMBER_COLS} FROM users u 
       WHERE (
         u.username = $1 
         OR lower(u.email) = lower($1)
         OR split_part(lower(u.email), '@', 1) = lower($1)
         OR ($2::boolean AND u.id = $3::uuid)
       ) AND u.organization_id = $4
         AND NOT (lower(u.email) = ANY($5::text[]))
         AND NOT (u.id = ANY($6::uuid[]))
       ORDER BY (u.username = $1) DESC
       LIMIT 1`,
      [clean, isUuid, isUuid ? clean : null, organizationId, hiddenEmails, hiddenIds]
    );
    return (r.rows[0] as TeamProfile | undefined) ?? null;
  });
}

export async function listUserSearches(organizationId: string, userId: string, limit: number, offset: number): Promise<UsageEvent[]> {
  return withTenant(organizationId, async db => {
    const r = await db.query(`SELECT e.id,e.query_key,e.created_at,c.id AS customer_id,c.name AS customer_name,c.reference AS customer_ref
      FROM search_events e
      LEFT JOIN customers c ON e.query_key = 'screen:' || c.id::text
      WHERE e.user_id=$1 ORDER BY e.created_at DESC LIMIT $2 OFFSET $3`, [userId, limit, offset]);
    return r.rows as UsageEvent[];
  });
}

export async function listUserActions(organizationId: string, userId: string, limit: number, offset: number): Promise<ActionEvent[]> {
  return withTenant(organizationId, async db => {
    const r = await db.query(`SELECT a.id,a.action,a.summary,a.created_at,a.customer_id,c.reference AS customer_ref
      FROM audit_events a LEFT JOIN customers c ON c.id=a.customer_id
      WHERE a.actor_id=$1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`, [userId, limit, offset]);
    return r.rows as ActionEvent[];
  });
}

// Admin creates a member in their own org. Admins get an unlimited quota; others get the set number.
export async function createTeamUser(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, raw: unknown) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  const input = teamUserSchema.parse(raw);
  const quota = input.role === 'admin' ? null : input.quota;
  const { hiddenEmails, hiddenIds } = getPlatformOwnerFilters();
  return withTenant(actor.organizationId, async db => {
    // Enforce the plan's team-member cap (platform-owner accounts don't count).
    const org = await db.query('SELECT member_limit FROM organizations WHERE id=$1', [actor.organizationId]);
    const limit = org.rows[0]?.member_limit ?? 5;
    const active = await db.query(
      `SELECT count(*)::int AS c FROM users 
       WHERE organization_id=$1 
         AND disabled_at IS NULL 
         AND NOT (lower(email) = ANY($2::text[]))
         AND NOT (id = ANY($3::uuid[]))`,
      [actor.organizationId, hiddenEmails, hiddenIds]
    );
    if (active.rows[0].c >= limit) throw new Error('MEMBER_LIMIT');
    const base = (input.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user');
    let username = base;
    for (let n = 2; n < 100; n++) {
      const taken = await db.query('SELECT 1 FROM users WHERE organization_id=$1 AND username=$2', [actor.organizationId, username]);
      if (!taken.rowCount) break;
      username = `${base}-${n}`;
    }
    await db.query(`INSERT INTO users(id,organization_id,username,email,display_name,role,password_hash,search_quota)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), actor.organizationId, username, input.email.toLowerCase(), input.displayName, input.role, hashPassword(input.password), quota]);
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,action,summary) VALUES ($1,$2,'user.created',$3)`,
      [actor.organizationId, actor.id, `أُنشئ مستخدم: ${input.displayName} · ${input.role} · حصة ${quota ?? '∞'}`]);
  });
}

export async function setUserQuota(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, userId: string, quota: number) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  const q = Math.max(0, Math.min(1000000, Math.floor(quota)));
  return withTenant(actor.organizationId, async db => {
    await assertNotSuperAdmin(db, userId);
    const r = await db.query(`UPDATE users SET search_quota=$3,
      quota_anchor=(SELECT count(*)::int FROM search_events e WHERE e.user_id=users.id)
      WHERE id=$1 AND organization_id=$2 AND role<>'admin' RETURNING display_name`, [userId, actor.organizationId, q]);
    if (r.rowCount) await db.query(`INSERT INTO audit_events(organization_id,actor_id,action,summary) VALUES ($1,$2,'user.quota',$3)`,
      [actor.organizationId, actor.id, `تعديل حصة ${r.rows[0].display_name} إلى ${q}`]);
  });
}

async function assertNotLastAdmin(db: PoolClient, organizationId: string, userId: string) {
  const { hiddenEmails, hiddenIds } = getPlatformOwnerFilters();
  const others = await db.query(
    `SELECT count(*)::int AS c FROM users 
     WHERE organization_id=$1 
       AND role='admin' 
       AND disabled_at IS NULL 
       AND id<>$2
       AND NOT (lower(email) = ANY($3::text[]))
       AND NOT (id = ANY($4::uuid[]))`,
    [organizationId, userId, hiddenEmails, hiddenIds]
  );
  if (others.rows[0].c === 0) throw new Error('LAST_ADMIN');
}

export async function setUserRole(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, userId: string, role: 'admin' | 'analyst' | 'viewer', quota: number) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  if (userId === actor.id) throw new Error('SELF');
  const q = role === 'admin' ? null : Math.max(0, Math.min(1000000, Math.floor(quota)));
  return withTenant(actor.organizationId, async db => {
    await assertNotSuperAdmin(db, userId);
    const current = await db.query(`SELECT role,display_name FROM users WHERE id=$1 AND organization_id=$2`, [userId, actor.organizationId]);
    if (!current.rowCount) throw new Error('NOT_FOUND');
    if (current.rows[0].role === 'admin' && role !== 'admin') await assertNotLastAdmin(db, actor.organizationId, userId);
    await db.query(`UPDATE users SET role=$3, search_quota=$4,
      quota_anchor=CASE WHEN $4::int IS NULL THEN quota_anchor ELSE (SELECT count(*)::int FROM search_events e WHERE e.user_id=users.id) END
      WHERE id=$1 AND organization_id=$2`, [userId, actor.organizationId, role, q]);
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,action,summary) VALUES ($1,$2,'user.role',$3)`,
      [actor.organizationId, actor.id, `تغيير دور ${current.rows[0].display_name} إلى ${role}`]);
  });
}

export async function setUserDisabled(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, userId: string, disabled: boolean) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  if (userId === actor.id) throw new Error('SELF');
  return withTenant(actor.organizationId, async db => {
    await assertNotSuperAdmin(db, userId);
    const current = await db.query(`SELECT role,display_name,disabled_at FROM users WHERE id=$1 AND organization_id=$2`, [userId, actor.organizationId]);
    if (!current.rowCount) throw new Error('NOT_FOUND');
    if (disabled && current.rows[0].role === 'admin' && !current.rows[0].disabled_at) await assertNotLastAdmin(db, actor.organizationId, userId);
    await db.query(`UPDATE users SET disabled_at=${disabled ? 'now()' : 'NULL'} WHERE id=$1 AND organization_id=$2`, [userId, actor.organizationId]);
    if (disabled) await db.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,action,summary) VALUES ($1,$2,'user.access',$3)`,
      [actor.organizationId, actor.id, `${disabled ? 'تعطيل' : 'تفعيل'} حساب ${current.rows[0].display_name}`]);
  });
}

export async function resetUserPassword(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, userId: string, password: string) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  if (userId === actor.id) throw new Error('SELF');
  return withTenant(actor.organizationId, async db => {
    await assertNotSuperAdmin(db, userId);
    const current = await db.query(`UPDATE users SET password_hash=$3 WHERE id=$1 AND organization_id=$2 RETURNING display_name`, [userId, actor.organizationId, hashPassword(password)]);
    if (!current.rowCount) throw new Error('NOT_FOUND');
    await db.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,action,summary) VALUES ($1,$2,'user.password',$3)`,
      [actor.organizationId, actor.id, `تعيين كلمة مرور جديدة لـ ${current.rows[0].display_name}`]);
  });
}

export async function updateUserProfile(
  actor: Pick<Actor, 'id' | 'organizationId' | 'role'>,
  userId: string,
  data: { displayName: string; email: string }
) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  const displayName = data.displayName.trim();
  const email = data.email.trim().toLowerCase();
  if (displayName.length < 2 || displayName.length > 80) throw new Error('INVALID_NAME');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_EMAIL');

  return withTenant(actor.organizationId, async db => {
    await assertNotSuperAdmin(db, userId);
    if (isSuperAdminEmail(email)) {
      throw new Error('EMAIL_TAKEN');
    }
    const existing = await db.query(
      'SELECT id FROM users WHERE lower(email) = $1 AND id <> $2',
      [email, userId]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new Error('EMAIL_TAKEN');
    }

    const current = await db.query(
      'SELECT display_name, email, username FROM users WHERE id = $1 AND organization_id = $2',
      [userId, actor.organizationId]
    );
    if (!current.rowCount) throw new Error('NOT_FOUND');

    const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user';
    let username = base;
    for (let n = 2; n < 100; n++) {
      const taken = await db.query(
        'SELECT 1 FROM users WHERE organization_id = $1 AND username = $2 AND id <> $3',
        [actor.organizationId, username, userId]
      );
      if (!taken.rowCount) break;
      username = `${base}-${n}`;
    }

    await db.query(
      `UPDATE users 
       SET display_name = $1, email = $2, username = $3
       WHERE id = $4 AND organization_id = $5`,
      [displayName, email, username, userId, actor.organizationId]
    );

    await db.query(
      `INSERT INTO audit_events(organization_id, actor_id, action, summary) VALUES ($1, $2, 'user.updated', $3)`,
      [
        actor.organizationId,
        actor.id,
        `تحديث بيانات المستخدم: ${current.rows[0].display_name} → ${displayName} (${email})`
      ]
    );

    return { displayName, email, username };
  });
}

export async function deleteTeamUser(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, userId: string) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  if (userId === actor.id) throw new Error('SELF');
  return withTenant(actor.organizationId, async db => {
    await assertNotSuperAdmin(db, userId);
    const current = await db.query(`SELECT role,display_name,disabled_at FROM users WHERE id=$1 AND organization_id=$2`, [userId, actor.organizationId]);
    if (!current.rowCount) throw new Error('NOT_FOUND');
    if (current.rows[0].role === 'admin' && !current.rows[0].disabled_at) await assertNotLastAdmin(db, actor.organizationId, userId);
    const history = await db.query(`SELECT
      (SELECT count(*)::int FROM search_events WHERE user_id=$1) AS searches,
      (SELECT count(*)::int FROM audit_events WHERE actor_id=$1) AS actions,
      (SELECT count(*)::int FROM customers WHERE created_by=$1) AS customers`, [userId]);
    const row = history.rows[0] as { searches: number; actions: number; customers: number };
    if (row.searches || row.actions || row.customers) throw new Error('HAS_HISTORY');
    await db.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM users WHERE id=$1 AND organization_id=$2', [userId, actor.organizationId]);
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,action,summary) VALUES ($1,$2,'user.deleted',$3)`,
      [actor.organizationId, actor.id, `حُذف المستخدم ${current.rows[0].display_name}`]);
  });
}

export async function clearUserSearches(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, userId: string) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  return withTenant(actor.organizationId, async db => {
    await assertNotSuperAdmin(db, userId);
    const user = await db.query('SELECT display_name FROM users WHERE id=$1 AND organization_id=$2', [userId, actor.organizationId]);
    if (!user.rowCount) throw new Error('NOT_FOUND');
    await db.query('DELETE FROM search_events WHERE organization_id=$1 AND user_id=$2', [actor.organizationId, userId]);
    await db.query('UPDATE users SET quota_anchor=0 WHERE organization_id=$1 AND id=$2', [actor.organizationId, userId]);
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,action,summary) VALUES ($1,$2,'user.searches_cleared',$3)`,
      [actor.organizationId, actor.id, `مسح سجل عمليات البحث للمستخدم ${user.rows[0].display_name}`]);
  });
}

export type Quota = { allowed: boolean; remaining: number | null; quota: number | null; used: number };
// Records a distinct search (deduped by query_key) and reports remaining quota. NULL quota = unlimited.
const allowance = (quota: number | null, lifetime: number, anchor: number) => {
  const used = Math.max(0, lifetime - anchor);
  return { used, remaining: quota == null ? null : Math.max(0, quota - used), allowed: quota == null || used < quota };
};

export async function consumeSearch(actor: Pick<Actor, 'id' | 'organizationId'>, queryKey: string, rawQuery?: string): Promise<Quota> {
  return withTenant(actor.organizationId, async db => {
    const row = (await db.query('SELECT search_quota, quota_anchor FROM users WHERE id=$1 FOR UPDATE', [actor.id])).rows[0];
    const quota = row?.search_quota ?? null;
    const anchor = row?.quota_anchor ?? 0;
    const lifetime = () => db.query('SELECT count(*)::int c FROM search_events WHERE user_id=$1', [actor.id]).then(r => r.rows[0].c as number);
    const seen = await db.query('SELECT 1 FROM search_events WHERE user_id=$1 AND query_key=$2', [actor.id, queryKey]);
    if (seen.rowCount) {
      if (rawQuery) {
        await db.query('UPDATE search_events SET created_at=now(), raw_query=$3 WHERE user_id=$1 AND query_key=$2', [actor.id, queryKey, rawQuery]);
      } else {
        await db.query('UPDATE search_events SET created_at=now() WHERE user_id=$1 AND query_key=$2', [actor.id, queryKey]);
      }
      const state = allowance(quota, await lifetime(), anchor);
      return { ...state, quota, allowed: true };
    }
    const state = allowance(quota, await lifetime(), anchor);
    if (!state.allowed) return { allowed: false, remaining: 0, quota, used: state.used };
    await db.query('INSERT INTO search_events(organization_id,user_id,query_key,raw_query) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,query_key) DO UPDATE SET created_at=now(), raw_query=COALESCE(EXCLUDED.raw_query, search_events.raw_query)', [actor.organizationId, actor.id, queryKey, rawQuery || null]);
    const nextRemaining = quota == null ? null : Math.max(0, quota - (state.used + 1));
    return { allowed: true, remaining: nextRemaining, used: state.used + 1, quota };
  });
}

// Read-only quota status (no consumption) for gating buttons/pages.
export async function quotaStatus(actor: Pick<Actor, 'id' | 'organizationId'>): Promise<Quota> {
  return withTenant(actor.organizationId, async db => {
    const row = (await db.query('SELECT search_quota, quota_anchor FROM users WHERE id=$1', [actor.id])).rows[0];
    const quota = row?.search_quota ?? null;
    const anchor = row?.quota_anchor ?? 0;
    const lifetime = (await db.query('SELECT count(*)::int c FROM search_events WHERE user_id=$1', [actor.id])).rows[0].c as number;
    return { ...allowance(quota, lifetime, anchor), quota };
  });
}

export type RecentSearchItem = { query: string; createdAt: Date };

export async function getRecentSearches(actor: Pick<Actor, 'id' | 'organizationId'>, limit = 10): Promise<RecentSearchItem[]> {
  return withTenant(actor.organizationId, async db => {
    // One chip per distinct query (its most recent run), newest first — so
    // repeating the same search never floods the list.
    const res = await db.query(`
      SELECT query, created_at FROM (
        SELECT DISTINCT ON (query_key)
          COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', '')) AS query, created_at
        FROM search_events
        WHERE user_id = $1 AND query_key LIKE 'query:%'
        ORDER BY query_key, created_at DESC
      ) d
      ORDER BY d.created_at DESC
      LIMIT $2
    `, [actor.id, limit]);
    return res.rows.map(r => ({
      query: r.query as string,
      createdAt: new Date(r.created_at)
    }));
  });
}

export type SearchHistoryRow = { query: string; createdAt: Date; count: number };

// Full, de-duplicated search history for the "view all" page (paginated).
export async function countSearchHistory(actor: Pick<Actor, 'id' | 'organizationId'>, filter?: string): Promise<number> {
  return withTenant(actor.organizationId, async db => {
    if (filter && filter.trim()) {
      const term = `%${filter.trim()}%`;
      const res = await db.query(
        `SELECT count(DISTINCT LOWER(TRIM(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', '')))))::int AS n
         FROM search_events
         WHERE user_id = $1 AND query_key LIKE 'query:%'
           AND (raw_query ILIKE $2 OR replace(query_key, 'query:', '') ILIKE $2)`,
        [actor.id, term]
      );
      return res.rows[0].n as number;
    }
    const res = await db.query(
      `SELECT count(DISTINCT LOWER(TRIM(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', '')))))::int AS n
       FROM search_events WHERE user_id = $1 AND query_key LIKE 'query:%'`,
      [actor.id]
    );
    return res.rows[0].n as number;
  });
}

export async function listSearchHistory(
  actor: Pick<Actor, 'id' | 'organizationId'>,
  opts: { limit?: number; offset?: number; filter?: string } = {}
): Promise<SearchHistoryRow[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
  const offset = Math.max(0, opts.offset ?? 0);
  return withTenant(actor.organizationId, async db => {
    if (opts.filter && opts.filter.trim()) {
      const term = `%${opts.filter.trim()}%`;
      const res = await db.query(`
        SELECT max(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', ''))) AS query,
               max(created_at) AS created_at, count(*)::int AS count
        FROM search_events
        WHERE user_id = $1 AND query_key LIKE 'query:%'
          AND (raw_query ILIKE $4 OR replace(query_key, 'query:', '') ILIKE $4)
        GROUP BY LOWER(TRIM(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', ''))))
        ORDER BY max(created_at) DESC
        LIMIT $2 OFFSET $3
      `, [actor.id, limit, offset, term]);
      return res.rows.map(r => ({ query: r.query as string, createdAt: new Date(r.created_at), count: r.count as number }));
    }
    const res = await db.query(`
      SELECT max(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', ''))) AS query,
             max(created_at) AS created_at, count(*)::int AS count
      FROM search_events
      WHERE user_id = $1 AND query_key LIKE 'query:%'
      GROUP BY LOWER(TRIM(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', ''))))
      ORDER BY max(created_at) DESC
      LIMIT $2 OFFSET $3
    `, [actor.id, limit, offset]);
    return res.rows.map(r => ({ query: r.query as string, createdAt: new Date(r.created_at), count: r.count as number }));
  });
}

export type SearchHistoryStats = {
  totalQueries: number;
  totalRuns: number;
  todayRuns: number;
  lastSearchAt: Date | null;
};

export async function getSearchHistoryStats(actor: Pick<Actor, 'id' | 'organizationId'>): Promise<SearchHistoryStats> {
  return withTenant(actor.organizationId, async db => {
    const res = await db.query(`
      SELECT 
        count(DISTINCT LOWER(TRIM(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', '')))))::int AS distinct_queries,
        count(*)::int AS total_events,
        count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today_events,
        max(created_at) AS last_search
      FROM search_events
      WHERE user_id = $1 AND query_key LIKE 'query:%'
    `, [actor.id]);
    const row = res.rows[0];
    return {
      totalQueries: Number(row?.distinct_queries ?? 0),
      totalRuns: Number(row?.total_events ?? 0),
      todayRuns: Number(row?.today_events ?? 0),
      lastSearchAt: row?.last_search ? new Date(row.last_search) : null,
    };
  });
}

export async function removeSearchHistoryItem(actor: Pick<Actor, 'id' | 'organizationId'>, query: string): Promise<void> {
  const clean = query.trim().toLowerCase();
  if (!clean) return;
  return withTenant(actor.organizationId, async db => {
    await db.query(`
      DELETE FROM search_events
      WHERE organization_id = $1 AND user_id = $2
        AND LOWER(TRIM(COALESCE(NULLIF(raw_query, ''), replace(query_key, 'query:', '')))) = $3
    `, [actor.organizationId, actor.id, clean]);
  });
}

export async function clearMySearchHistory(actor: Pick<Actor, 'id' | 'organizationId'>): Promise<void> {
  return withTenant(actor.organizationId, async db => {
    await db.query(`DELETE FROM search_events WHERE organization_id = $1 AND user_id = $2 AND query_key LIKE 'query:%'`, [actor.organizationId, actor.id]);
  });
}

