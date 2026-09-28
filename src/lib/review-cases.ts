import { withTenant } from './db';
import { canManageCustomers } from './validation';
import { platformOwnerEmails, platformOwnerIds } from './platform-access';
import type { Actor } from './auth';

export type ReviewCaseStatus = 'open' | 'in_review' | 'resolved';
export type ReviewPriority = 'high' | 'medium' | 'low';
export type ReviewCaseFilters = { status?: string; priority?: string; assignee?: string; query?: string; sort?: string; limit?: number; offset?: number; actorId?: string };
export type ReviewCase = {
  id: string; customer_id: string; customer_name: string; customer_reference: string; entity_type: string; country: string;
  screening_id: string; priority: ReviewPriority; status: ReviewCaseStatus; assigned_to: string | null; assigned_name: string | null;
  created_at: Date; updated_at: Date; overall_band: string; relevant_count: number;
  top_matches: { category?: string; categoryLabel?: string; name?: string }[];
};
export type ReviewQueueStats = { open: number; inReview: number; high: number; unassigned: number };
export type ReviewAssignee = { id: string; display_name: string; role: string };
const statuses = new Set<ReviewCaseStatus>(['open', 'in_review', 'resolved']);
const priorities = new Set<ReviewPriority>(['high', 'medium', 'low']);

export async function listReviewCases(organizationId: string, filters: ReviewCaseFilters = {}): Promise<ReviewCase[]> {
  return withTenant(organizationId, async db => {
    const clauses = [
      'rc.organization_id = $1',
      filters.status === 'resolved' ? "rc.status = 'resolved'" : "rc.status <> 'resolved'"
    ];
    const params: unknown[] = [organizationId];
    if (statuses.has(filters.status as ReviewCaseStatus) && filters.status !== 'resolved') { params.push(filters.status); clauses.push(`rc.status=$${params.length}`); }
    if (priorities.has(filters.priority as ReviewPriority)) { params.push(filters.priority); clauses.push(`rc.priority=$${params.length}`); }
    if (filters.assignee === 'unassigned') clauses.push('rc.assigned_to IS NULL');
    if (filters.assignee && filters.assignee !== 'unassigned') { params.push(filters.assignee); clauses.push(`rc.assigned_to=$${params.length}`); }
    if (filters.actorId) { params.push(filters.actorId); clauses.push(`(rc.assigned_to=$${params.length} OR c.created_by=$${params.length})`); }
    const query = (filters.query ?? '').trim().slice(0, 160).replace(/[\\%_]/g, '\\$&');
    if (query) { params.push(query); clauses.push(`(c.name ILIKE '%' || $${params.length} || '%' OR c.reference ILIKE '%' || $${params.length} || '%')`); }
    const orderBy = filters.sort === 'recent' ? 'rc.updated_at DESC, rc.created_at DESC' : filters.sort === 'oldest' ? 'rc.created_at ASC' : "CASE rc.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, rc.created_at ASC";
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = Math.max(0, filters.offset ?? 0);
    params.push(limit, offset);
    const r = await db.query(`SELECT rc.id,rc.customer_id,c.name AS customer_name,c.reference AS customer_reference,c.entity_type,c.country,
      rc.screening_id,rc.priority,rc.status,rc.assigned_to,u.display_name AS assigned_name,rc.created_at,rc.updated_at,
      s.overall_band,s.relevant_count,s.top_matches
      FROM review_cases rc JOIN customers c ON c.id=rc.customer_id JOIN customer_screenings s ON s.id=rc.screening_id
      LEFT JOIN users u ON u.id=rc.assigned_to WHERE ${clauses.join(' AND ')}
      ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return r.rows as ReviewCase[];
  });
}

export async function countReviewCases(organizationId: string, filters: ReviewCaseFilters = {}): Promise<number> {
  return withTenant(organizationId, async db => {
    const clauses = [
      'rc.organization_id = $1',
      filters.status === 'resolved' ? "rc.status = 'resolved'" : "rc.status <> 'resolved'"
    ];
    const params: unknown[] = [organizationId];
    if (statuses.has(filters.status as ReviewCaseStatus) && filters.status !== 'resolved') { params.push(filters.status); clauses.push(`rc.status=$${params.length}`); }
    if (priorities.has(filters.priority as ReviewPriority)) { params.push(filters.priority); clauses.push(`rc.priority=$${params.length}`); }
    if (filters.assignee === 'unassigned') clauses.push('rc.assigned_to IS NULL');
    if (filters.assignee && filters.assignee !== 'unassigned') { params.push(filters.assignee); clauses.push(`rc.assigned_to=$${params.length}`); }
    if (filters.actorId) { params.push(filters.actorId); clauses.push(`(rc.assigned_to=$${params.length} OR c.created_by=$${params.length})`); }
    const query = (filters.query ?? '').trim().slice(0, 160).replace(/[\\%_]/g, '\\$&');
    if (query) { params.push(query); clauses.push(`(c.name ILIKE '%' || $${params.length} || '%' OR c.reference ILIKE '%' || $${params.length} || '%')`); }
    const r = await db.query(`SELECT count(*)::int AS n FROM review_cases rc JOIN customers c ON c.id=rc.customer_id WHERE ${clauses.join(' AND ')}`, params);
    return r.rows[0].n as number;
  });
}

export async function getReviewQueueStats(organizationId: string, actorId?: string): Promise<ReviewQueueStats> {
  return withTenant(organizationId, async db => {
    if (actorId) {
      const r = await db.query(`SELECT
        count(*) FILTER (WHERE rc.status='open')::int AS open,
        count(*) FILTER (WHERE rc.status='in_review')::int AS "inReview",
        count(*) FILTER (WHERE rc.status<>'resolved' AND rc.priority='high')::int AS high,
        0::int AS unassigned
        FROM review_cases rc
        JOIN customers c ON c.id = rc.customer_id
        WHERE rc.organization_id = $1 AND (rc.assigned_to = $2 OR c.created_by = $2)`, [organizationId, actorId]);
      return r.rows[0] as ReviewQueueStats;
    }
    const r = await db.query(`SELECT count(*) FILTER (WHERE status='open')::int AS open,
      count(*) FILTER (WHERE status='in_review')::int AS "inReview",
      count(*) FILTER (WHERE status<>'resolved' AND priority='high')::int AS high,
      count(*) FILTER (WHERE status<>'resolved' AND assigned_to IS NULL)::int AS unassigned FROM review_cases WHERE organization_id = $1`, [organizationId]);
    return r.rows[0] as ReviewQueueStats;
  });
}

export async function listReviewAssignees(organizationId: string): Promise<ReviewAssignee[]> {
  const hiddenEmails = platformOwnerEmails().map(e => e.toLowerCase());
  const hiddenIds = platformOwnerIds();
  return withTenant(organizationId, async db => {
    const r = await db.query(
      `SELECT id,display_name,role FROM users 
       WHERE organization_id=$1 AND disabled_at IS NULL
         AND role IN ('admin','analyst')
         AND NOT (lower(email) = ANY($2::text[]))
         AND NOT (id = ANY($3::uuid[]))
       ORDER BY display_name`,
      [organizationId, hiddenEmails, hiddenIds]
    );
    return r.rows as ReviewAssignee[];
  });
}

export async function assignReviewCase(actor: Pick<Actor, 'id'|'organizationId'|'role'>, caseId: string, assigneeId: string | null, claim = false) {
  if (!canManageCustomers(actor.role)) throw new Error('FORBIDDEN');
  const target = claim ? actor.id : assigneeId;
  if (!claim && actor.role !== 'admin') throw new Error('FORBIDDEN');
  return withTenant(actor.organizationId, async db => {
    if (target) {
      const person = await db.query(`SELECT id FROM users WHERE id=$1 AND organization_id=$2 AND disabled_at IS NULL
        AND role IN ('admin','analyst')`, [target, actor.organizationId]);
      if (!person.rowCount) throw new Error('ASSIGNEE_NOT_FOUND');
    }
    if (claim && actor.role !== 'admin') {
      const ownerCheck = await db.query(
        `SELECT c.created_by FROM review_cases rc JOIN customers c ON c.id = rc.customer_id WHERE rc.id = $1 AND rc.organization_id = $2`,
        [caseId, actor.organizationId]
      );
      if (!ownerCheck.rowCount) throw new Error('NOT_FOUND');
      if (ownerCheck.rows[0].created_by && ownerCheck.rows[0].created_by !== actor.id) {
        throw new Error('FORBIDDEN');
      }
    }
    const updated = await db.query(`UPDATE review_cases SET assigned_to=$2, assigned_at=CASE WHEN $2::uuid IS NULL THEN NULL ELSE now() END,
      status=CASE WHEN $2::uuid IS NULL THEN 'open' ELSE 'in_review' END, updated_at=now()
      WHERE id=$1 AND status<>'resolved' RETURNING customer_id`, [caseId, target]);
    if (!updated.rowCount) throw new Error('NOT_FOUND');
    const summary = target ? (claim ? 'استلم مراجعة حالة فحص' : 'وزّع حالة مراجعة فحص') : 'أعاد حالة المراجعة إلى قائمة الانتظار';
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary) VALUES ($1,$2,$3,'review.assigned',$4)`,
      [actor.organizationId, actor.id, updated.rows[0].customer_id, summary]);
  });
}

// A case closes only when every displayed material match has a final analyst
// decision. "Needs info" intentionally keeps it in the queue.
export async function refreshReviewCasesAfterDecision(organizationId: string, customerId: string, actorId: string) {
  return withTenant(organizationId, async db => {
    const cases = await db.query(`SELECT rc.id,s.top_matches FROM review_cases rc
      JOIN customer_screenings s ON s.id=rc.screening_id
      WHERE rc.customer_id=$1 AND rc.status<>'resolved'`, [customerId]);
    let closed = 0;
    for (const item of cases.rows) {
      const rawMatches = item.top_matches;
      const topMatches = (Array.isArray(rawMatches)
        ? rawMatches
        : (typeof rawMatches === 'string' ? JSON.parse(rawMatches) : [])) as { recordId?: string; percent?: number }[];

      // A case closes when every material match (>= 80%) has a final decision (confirmed or dismissed).
      // Matches < 80% are auto-excluded noise and do not block case resolution.
      const materialRecords = topMatches
        .filter(match => (match.percent ?? 100) >= 80 && match.recordId)
        .map(match => match.recordId as string);

      if (!materialRecords.length) {
        await db.query(`UPDATE review_cases SET status='resolved',updated_at=now() WHERE id=$1`, [item.id]);
        closed++;
        continue;
      }

      const decisions = await db.query(`SELECT DISTINCT ON (record_id) record_id,decision FROM match_decisions
        WHERE customer_id=$1 AND record_id = ANY($2::text[]) ORDER BY record_id,created_at DESC`, [customerId, materialRecords]);
      const latest = new Map(decisions.rows.map(row => [row.record_id, row.decision]));
      if (!materialRecords.every(id => latest.get(id) === 'confirmed' || latest.get(id) === 'dismissed')) continue;
      await db.query(`UPDATE review_cases SET status='resolved',updated_at=now() WHERE id=$1`, [item.id]);
      closed++;
    }
    if (closed) await db.query(`INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary) VALUES ($1,$2,$3,'review.resolved',$4)`,
      [organizationId, actorId, customerId, `اكتملت قرارات المراجعة لعدد ${closed} حالة`]);
    return closed;
  });
}
