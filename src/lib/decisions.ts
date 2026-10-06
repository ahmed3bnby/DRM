import { withTenant } from './db';
import { canManageCustomers } from './validation';
import type { Actor } from './auth';
import { refreshReviewCasesAfterDecision } from './review-cases';
import { getSourceRecord } from './search';
import { enrichCustomerFromMatch } from './customers';
import { extractRecordCountry, extractRecordDob, extractRecordIdentifier } from './record-details';

export type Decision = 'confirmed' | 'dismissed' | 'needs_info';
export const DECISION_LABEL: Record<Decision, string> = {
  confirmed: 'تطابق مؤكد', dismissed: 'مستبعد (إيجابي كاذب)', needs_info: 'يحتاج معلومات',
};
const VALID: Decision[] = ['confirmed', 'dismissed', 'needs_info'];

export type DecisionRow = {
  id?: string;
  record_id: string;
  decision: Decision;
  reason: string;
  created_at: Date;
  decided_by?: string;
  decided_by_name?: string;
};

// Append an analyst determination on one match. History is preserved (latest row wins) and every
// decision writes an audit event with its mandatory reason.
export async function recordMatchDecision(
  actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, customerId: string, recordId: string, decision: string, reason: string,
) {
  if (!canManageCustomers(actor.role)) throw new Error('FORBIDDEN');
  if (!VALID.includes(decision as Decision)) throw new Error('BAD_DECISION');
  const trimmed = reason.trim().slice(0, 500);
  if (!trimmed) throw new Error('REASON_REQUIRED');
  await withTenant(actor.organizationId, async db => {
    const cust = await db.query(
      'SELECT created_by FROM customers WHERE organization_id = $1 AND id = $2',
      [actor.organizationId, customerId]
    );
    if (!cust.rowCount) throw new Error('NOT_FOUND');
    if (actor.role !== 'admin' && cust.rows[0].created_by && cust.rows[0].created_by !== actor.id) {
      throw new Error('FORBIDDEN_NOT_CREATOR');
    }

    await db.query(
      `INSERT INTO match_decisions(organization_id,customer_id,record_id,decision,reason,decided_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [actor.organizationId, customerId, recordId, decision, trimmed, actor.id]);
    await db.query(
      `INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary) VALUES ($1,$2,$3,'match.decided',$4)`,
      [actor.organizationId, actor.id, customerId, `قرار مراجعة: ${DECISION_LABEL[decision as Decision]} — ${trimmed}`]);
  });
  await refreshReviewCasesAfterDecision(actor.organizationId, customerId, actor.id);
  if (decision === 'confirmed') {
    try {
      const srcRecord = await getSourceRecord(recordId);
      if (srcRecord) {
        const country = extractRecordCountry(srcRecord.details);
        const dob = extractRecordDob(srcRecord.details);
        const identifier = extractRecordIdentifier(srcRecord.details);   // document numbers only, not the list record id
        await enrichCustomerFromMatch(actor.organizationId, actor.id, customerId, {
          country,
          dob,
          identifier,
          sourceName: srcRecord.name || srcRecord.code,
        });
      }
    } catch {
      // Enrichment failure should not block the decision persistence
    }
  }
}

// Latest decision per source record for a customer, including analyst display name.
export async function getMatchDecisions(organizationId: string, customerId: string): Promise<Record<string, DecisionRow>> {
  return withTenant(organizationId, async db => {
    const r = await db.query(
      `SELECT DISTINCT ON (md.record_id) md.id, md.record_id, md.decision, md.reason, md.created_at, md.decided_by, u.display_name AS decided_by_name
       FROM match_decisions md
       LEFT JOIN users u ON u.id = md.decided_by
       WHERE md.organization_id=$1 AND md.customer_id=$2 ORDER BY md.record_id, md.created_at DESC`, [organizationId, customerId]);
    return Object.fromEntries(r.rows.map(row => [row.record_id, row as DecisionRow]));
  });
}

// Complete decision history across all matches for this customer, newest first.
export async function getMatchDecisionHistory(organizationId: string, customerId: string): Promise<DecisionRow[]> {
  return withTenant(organizationId, async db => {
    const r = await db.query(
      `SELECT md.id, md.record_id, md.decision, md.reason, md.created_at, md.decided_by, u.display_name AS decided_by_name
       FROM match_decisions md
       LEFT JOIN users u ON u.id = md.decided_by
       WHERE md.organization_id=$1 AND md.customer_id=$2 ORDER BY md.created_at DESC`, [organizationId, customerId]);
    return r.rows as DecisionRow[];
  });
}
