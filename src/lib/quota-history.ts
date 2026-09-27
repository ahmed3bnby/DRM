import type { Pool, PoolClient } from 'pg';
import { pool } from './db';

export type QuotaActionType = 'quota_credited' | 'quota_updated' | 'user_created' | 'role_changed';

export type QuotaHistoryRecord = {
  id: string;
  organizationId: string;
  organizationName?: string;
  userId: string;
  userDisplayName?: string;
  userEmail?: string;
  username?: string;
  actorId: string | null;
  actorName: string;
  previousQuota: number | null;
  newQuota: number | null;
  delta: number | null;
  actionType: QuotaActionType;
  note: string | null;
  createdAt: string;
};

export type RecordQuotaChangeOptions = {
  organizationId: string;
  userId: string;
  actorId?: string | null;
  actorName?: string;
  previousQuota?: number | null;
  newQuota?: number | null;
  delta?: number | null;
  actionType?: QuotaActionType;
  note?: string | null;
};

export async function recordQuotaChange(
  db: Pool | PoolClient,
  opts: RecordQuotaChangeOptions
): Promise<void> {
  try {
    const delta = opts.delta !== undefined ? opts.delta : (
      opts.newQuota != null && opts.previousQuota != null
        ? opts.newQuota - opts.previousQuota
        : (opts.newQuota != null ? opts.newQuota : null)
    );

    await db.query(
      `INSERT INTO quota_history (
        organization_id, user_id, actor_id, actor_name,
        previous_quota, new_quota, delta, action_type, note, created_at
      ) VALUES ($1, $2, (SELECT id FROM users WHERE id = $3), $4, $5, $6, $7, $8, $9, now())`,
      [
        opts.organizationId,
        opts.userId,
        opts.actorId || null,
        opts.actorName || 'النظام',
        opts.previousQuota !== undefined ? opts.previousQuota : null,
        opts.newQuota !== undefined ? opts.newQuota : null,
        delta,
        opts.actionType || 'quota_updated',
        opts.note || null,
      ]
    );
  } catch (err) {
    console.error('Failed to record quota change history:', err);
  }
}
