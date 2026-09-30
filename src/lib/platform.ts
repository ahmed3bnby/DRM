import { pool, withPlatformOwner } from './db';
import { PREMIUM_FEATURES } from './features';
import { platformOwnerEmails, platformOwnerIds, isPlatformOwner } from './platform-access';
import type { Actor } from './auth';
import { recordQuotaChange } from './quota-history';

// Platform-owner (super admin) operations act ACROSS organizations, so they use
// the base pool without a tenant scope. Only organizations/users are read here
// (neither is row-level-security protected); tenant data is never touched.
export type PlatformOrg = {
  id: string; name: string; reference: string; plan: string;
  features: Record<string, boolean>; member_limit: number; users: number;
};

export async function listAllOrgs(): Promise<PlatformOrg[]> {
  try {
    const hiddenEmails = platformOwnerEmails().map(e => e.toLowerCase());
    const hiddenIds = platformOwnerIds();
    const r = await pool.query(`SELECT o.id,o.name,o.reference,o.plan,o.features,o.member_limit,
      (SELECT count(*)::int FROM users u 
       WHERE u.organization_id=o.id 
         AND u.disabled_at IS NULL 
         AND NOT (lower(u.email) = ANY($1::text[])) 
         AND NOT (u.id = ANY($2::uuid[]))) AS users
      FROM organizations o ORDER BY o.name`, [hiddenEmails, hiddenIds]);
    return r.rows as PlatformOrg[];
  } catch (err) {
    console.error('listAllOrgs error:', err);
    return [];
  }
}

export async function updateOrgPlan(orgId: string, patch: { features: Record<string, boolean>; member_limit: number; plan: string }) {
  // Whitelist feature keys so only known premium flags are ever stored.
  const features: Record<string, boolean> = {};
  for (const key of PREMIUM_FEATURES) features[key] = patch.features[key] === true;
  const limit = Math.max(1, Math.min(1000, Math.floor(patch.member_limit || 5)));
  const plan = ['base', 'pro', 'enterprise'].includes(patch.plan) ? patch.plan : 'base';
  await pool.query('UPDATE organizations SET features=$2, member_limit=$3, plan=$4 WHERE id=$1',
    [orgId, JSON.stringify(features), limit, plan]);
}

export type SystemLockdown = {
  enabled: boolean;
  message_ar?: string;
  message_en?: string;
  updated_at?: string;
  updated_by?: string;
};

export async function getSystemLockdown(): Promise<SystemLockdown> {
  try {
    const res = await pool.query(
      `SELECT value, updated_at, updated_by FROM system_settings WHERE key = 'system_lockdown'`
    );
    if (!res.rowCount || !res.rows[0]) {
      return { enabled: false };
    }
    const row = res.rows[0];
    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    return {
      enabled: !!val?.enabled,
      message_ar: val?.message_ar || '',
      message_en: val?.message_en || '',
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      updated_by: row.updated_by || undefined,
    };
  } catch (err) {
    console.error('Failed to query system lockdown status:', err);
    return { enabled: false };
  }
}

export async function setSystemLockdown(
  actor: { id: string; email?: string; role: string },
  enabled: boolean,
  messageAr?: string,
  messageEn?: string
) {
  const payload = {
    enabled,
    message_ar: messageAr?.trim() || '',
    message_en: messageEn?.trim() || '',
  };
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at, updated_by)
     VALUES ('system_lockdown', $1::jsonb, now(), $2)
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify(payload), actor.id]
  );
}

export type PlatformChecksSummary = {
  totalChecks: number;
  todayChecks: number;
  weekChecks: number;
  activeAccounts: number;
  totalAllocatedQuota: number;
  totalAccountsWithQuota: number;
  unlimitedAccounts: number;
  totalMonitoredCustomers: number;
  totalMonitoringAlerts: number;
};

export async function getPlatformChecksSummary(): Promise<PlatformChecksSummary> {
  const fallback: PlatformChecksSummary = {
    totalChecks: 0,
    todayChecks: 0,
    weekChecks: 0,
    activeAccounts: 0,
    totalAllocatedQuota: 0,
    totalAccountsWithQuota: 0,
    unlimitedAccounts: 0,
    totalMonitoredCustomers: 0,
    totalMonitoringAlerts: 0,
  };

  try {
    const hiddenEmails = platformOwnerEmails().map(e => e.toLowerCase());
    const hiddenIds = platformOwnerIds();

    return await withPlatformOwner(async db => {
      const [statsRes, quotaRes, monitorRes] = await Promise.all([
        db.query(`
          SELECT 
            count(*)::int AS total_checks,
            count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today_checks,
            count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week_checks,
            count(DISTINCT user_id)::int AS active_accounts
          FROM search_events
        `),
        db.query(`
          SELECT 
            COALESCE(sum(search_quota), 0)::int AS total_allocated,
            count(*) FILTER (WHERE search_quota IS NOT NULL)::int AS accounts_with_quota,
            count(*) FILTER (WHERE search_quota IS NULL)::int AS unlimited_accounts
          FROM users
          WHERE disabled_at IS NULL
            AND NOT (lower(email) = ANY($1::text[]))
            AND NOT (id = ANY($2::uuid[]))
        `, [hiddenEmails, hiddenIds]),
        db.query(`
          SELECT
            (SELECT count(*)::int FROM customers WHERE monitoring_enabled = true) AS monitored_customers,
            (SELECT count(*)::int FROM customer_monitoring_events WHERE NOT is_read) AS unread_alerts
        `)
      ]);

      const s = statsRes.rows[0] || {};
      const q = quotaRes.rows[0] || {};
      const m = monitorRes.rows[0] || {};

      return {
        totalChecks: Number(s.total_checks ?? 0),
        todayChecks: Number(s.today_checks ?? 0),
        weekChecks: Number(s.week_checks ?? 0),
        activeAccounts: Number(s.active_accounts ?? 0),
        totalAllocatedQuota: Number(q.total_allocated ?? 0),
        totalAccountsWithQuota: Number(q.accounts_with_quota ?? 0),
        unlimitedAccounts: Number(q.unlimited_accounts ?? 0),
        totalMonitoredCustomers: Number(m.monitored_customers ?? 0),
        totalMonitoringAlerts: Number(m.unread_alerts ?? 0),
      };
    });
  } catch (err) {
    console.error('getPlatformChecksSummary error:', err);
    return fallback;
  }
}

export type AccountQuotaItem = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
  searchQuota: number | null;
  quotaAnchor: number;
  organizationId: string;
  organizationName: string;
  lifetimeChecks: number;
  usedInCycle: number;
  remaining: number | null;
  disabledAt: string | null;
  lastCheckAt: string | null;
  lastCreditAt: string | null;
  lastCreditDelta: number | null;
  lastCreditAction: string | null;
};

function mapAccountsQuotaRows(rows: any[]): AccountQuotaItem[] {
  return rows.map(row => {
    const quota = row.search_quota !== null && row.search_quota !== undefined ? Number(row.search_quota) : null;
    const anchor = Number(row.quota_anchor ?? 0);
    const lifetime = Number(row.lifetime_checks ?? 0);
    const usedInCycle = Math.max(0, lifetime - anchor);
    const remaining = quota === null ? null : Math.max(0, quota - usedInCycle);

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      searchQuota: quota,
      quotaAnchor: anchor,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      lifetimeChecks: lifetime,
      usedInCycle,
      remaining,
      disabledAt: row.disabled_at ? new Date(row.disabled_at).toISOString() : null,
      lastCheckAt: row.last_check_at ? new Date(row.last_check_at).toISOString() : null,
      lastCreditAt: row.last_credit_at ? new Date(row.last_credit_at).toISOString() : null,
      lastCreditDelta: row.last_credit_delta !== null && row.last_credit_delta !== undefined ? Number(row.last_credit_delta) : null,
      lastCreditAction: row.last_credit_action || null,
    };
  });
}

export async function listAllAccountsQuota(): Promise<AccountQuotaItem[]> {
  try {
    const hiddenEmails = platformOwnerEmails().map(e => e.toLowerCase());
    const hiddenIds = platformOwnerIds();

    return await withPlatformOwner(async db => {
      try {
        const res = await db.query(`
          SELECT 
            u.id,
            COALESCE(NULLIF(u.username, ''), split_part(u.email, '@', 1), u.id::text) AS username,
            u.email,
            u.display_name,
            u.role,
            u.search_quota,
            u.quota_anchor,
            u.disabled_at,
            o.id AS organization_id,
            o.name AS organization_name,
            (SELECT count(*)::int FROM search_events e WHERE e.user_id = u.id) AS lifetime_checks,
            (SELECT max(e.created_at) FROM search_events e WHERE e.user_id = u.id) AS last_check_at,
            (SELECT qh.created_at FROM quota_history qh WHERE qh.user_id = u.id ORDER BY qh.created_at DESC LIMIT 1) AS last_credit_at,
            (SELECT qh.delta FROM quota_history qh WHERE qh.user_id = u.id ORDER BY qh.created_at DESC LIMIT 1) AS last_credit_delta,
            (SELECT qh.action_type FROM quota_history qh WHERE qh.user_id = u.id ORDER BY qh.created_at DESC LIMIT 1) AS last_credit_action
          FROM users u
          JOIN organizations o ON o.id = u.organization_id
          WHERE NOT (lower(u.email) = ANY($1::text[]))
            AND NOT (u.id = ANY($2::uuid[]))
          ORDER BY (u.disabled_at IS NOT NULL), o.name, u.role, u.display_name
        `, [hiddenEmails, hiddenIds]);

        return mapAccountsQuotaRows(res.rows);
      } catch (innerErr) {
        console.warn('listAllAccountsQuota: primary query failed, retrying without quota_history join:', innerErr);
        const res = await db.query(`
          SELECT 
            u.id,
            COALESCE(NULLIF(u.username, ''), split_part(u.email, '@', 1), u.id::text) AS username,
            u.email,
            u.display_name,
            u.role,
            u.search_quota,
            u.quota_anchor,
            u.disabled_at,
            o.id AS organization_id,
            o.name AS organization_name,
            (SELECT count(*)::int FROM search_events e WHERE e.user_id = u.id) AS lifetime_checks,
            (SELECT max(e.created_at) FROM search_events e WHERE e.user_id = u.id) AS last_check_at,
            NULL::timestamptz AS last_credit_at,
            NULL::int AS last_credit_delta,
            NULL::text AS last_credit_action
          FROM users u
          JOIN organizations o ON o.id = u.organization_id
          WHERE NOT (lower(u.email) = ANY($1::text[]))
            AND NOT (u.id = ANY($2::uuid[]))
          ORDER BY (u.disabled_at IS NOT NULL), o.name, u.role, u.display_name
        `, [hiddenEmails, hiddenIds]);

        return mapAccountsQuotaRows(res.rows);
      }
    });
  } catch (err) {
    console.error('listAllAccountsQuota fatal error:', err);
    return [];
  }
}

export type PlatformQuotaHistoryItem = {
  id: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  username: string;
  actorId: string | null;
  actorName: string;
  previousQuota: number | null;
  newQuota: number | null;
  delta: number | null;
  actionType: string;
  note: string | null;
  createdAt: string;
};

export async function listQuotaHistory(limit = 100): Promise<PlatformQuotaHistoryItem[]> {
  const safeLimit = Math.min(500, Math.max(1, limit));
  try {
    const res = await pool.query(`
      SELECT 
        qh.id,
        qh.organization_id,
        COALESCE(o.name, 'مؤسسة غير معروفة') AS organization_name,
        qh.user_id,
        COALESCE(u.display_name, 'مستخدم سابق') AS user_display_name,
        COALESCE(u.email, '') AS user_email,
        COALESCE(NULLIF(u.username, ''), split_part(u.email, '@', 1), '') AS username,
        qh.actor_id,
        COALESCE(NULLIF(qh.actor_name, ''), 'النظام') AS actor_name,
        qh.previous_quota,
        qh.new_quota,
        qh.delta,
        qh.action_type,
        qh.note,
        qh.created_at
      FROM quota_history qh
      LEFT JOIN organizations o ON o.id = qh.organization_id
      LEFT JOIN users u ON u.id = qh.user_id
      ORDER BY qh.created_at DESC
      LIMIT $1
    `, [safeLimit]);

    return res.rows.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      userId: r.user_id,
      userDisplayName: r.user_display_name,
      userEmail: r.user_email,
      username: r.username,
      actorId: r.actor_id,
      actorName: r.actor_name,
      previousQuota: r.previous_quota !== null ? Number(r.previous_quota) : null,
      newQuota: r.new_quota !== null ? Number(r.new_quota) : null,
      delta: r.delta !== null ? Number(r.delta) : null,
      actionType: r.action_type,
      note: r.note,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch (err) {
    console.error('listQuotaHistory query error:', err);
    return [];
  }
}

export type SuperAdminCreditOptions = {
  mode: 'add' | 'set' | 'unlimited';
  amount?: number;
  resetAnchor?: boolean;
  note?: string;
};

export async function superAdminCreditUserQuota(
  actor: Pick<Actor, 'id' | 'displayName' | 'email' | 'role'>,
  targetUserId: string,
  opts: SuperAdminCreditOptions
): Promise<{ success: boolean; newQuota: number | null; delta: number | null }> {
  if (!isPlatformOwner(actor)) {
    throw new Error('FORBIDDEN');
  }

  const userRes = await pool.query(
    'SELECT id, organization_id, display_name, email, role, search_quota, quota_anchor FROM users WHERE id = $1',
    [targetUserId]
  );
  if (!userRes.rowCount || !userRes.rows[0]) {
    throw new Error('NOT_FOUND');
  }

  const targetUser = userRes.rows[0];
  const prevQuota = targetUser.search_quota !== null ? Number(targetUser.search_quota) : null;
  const actorName = `${actor.displayName || 'Super Admin'} (إدارة النظام)`;

  if (opts.mode === 'add') {
    const delta = Math.max(1, Math.min(1000000, Math.floor(opts.amount || 0)));
    const newQuota = (prevQuota ?? 0) + delta;

    await pool.query('UPDATE users SET search_quota = $1 WHERE id = $2', [newQuota, targetUserId]);

    await recordQuotaChange(pool, {
      organizationId: targetUser.organization_id,
      userId: targetUserId,
      actorId: actor.id,
      actorName,
      previousQuota: prevQuota,
      newQuota,
      delta,
      actionType: 'quota_credited',
      note: opts.note?.trim() || `شحن رصيد إضافي (+${delta} تشييكة) بواسطة المشرف العام`,
    });

    return { success: true, newQuota, delta };
  } else if (opts.mode === 'set') {
    const newQuota = Math.max(0, Math.min(1000000, Math.floor(opts.amount ?? 0)));
    const delta = prevQuota !== null ? newQuota - prevQuota : newQuota;

    if (opts.resetAnchor) {
      await pool.query(
        `UPDATE users 
         SET search_quota = $1, 
             quota_anchor = (SELECT count(*)::int FROM search_events e WHERE e.user_id = users.id)
         WHERE id = $2`,
        [newQuota, targetUserId]
      );
    } else {
      await pool.query('UPDATE users SET search_quota = $1 WHERE id = $2', [newQuota, targetUserId]);
    }

    await recordQuotaChange(pool, {
      organizationId: targetUser.organization_id,
      userId: targetUserId,
      actorId: actor.id,
      actorName,
      previousQuota: prevQuota,
      newQuota,
      delta,
      actionType: 'quota_updated',
      note: opts.note?.trim() || `تعديل الحصة إلى ${newQuota} تشييكة بواسطة المشرف العام`,
    });

    return { success: true, newQuota, delta };
  } else if (opts.mode === 'unlimited') {
    await pool.query('UPDATE users SET search_quota = NULL WHERE id = $1', [targetUserId]);

    await recordQuotaChange(pool, {
      organizationId: targetUser.organization_id,
      userId: targetUserId,
      actorId: actor.id,
      actorName,
      previousQuota: prevQuota,
      newQuota: null,
      delta: null,
      actionType: 'quota_updated',
      note: opts.note?.trim() || 'إلغاء الحد وتعيين الحصة كغير محدودة (∞)',
    });

    return { success: true, newQuota: null, delta: null };
  }

  throw new Error('INVALID_MODE');
}
