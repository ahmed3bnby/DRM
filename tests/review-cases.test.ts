import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { withTenant } from '../src/lib/db';
import { createCustomer } from '../src/lib/customers';
import { assignReviewCase, listReviewAssignees, listReviewCases, refreshReviewCasesAfterDecision } from '../src/lib/review-cases';
import { recordMatchDecision } from '../src/lib/decisions';

const org = '10000000-0000-4000-8000-000000000001';
const otherOrg = '10000000-0000-4000-8000-000000000002';
const actor = { id: '20000000-0000-4000-8000-000000000001', organizationId: org, role: 'admin' as const };
const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
const customerIds: string[] = []; const screeningIds: string[] = []; const caseIds: string[] = [];

after(async () => {
  for (const id of customerIds) {
    await admin.query('DELETE FROM match_decisions WHERE customer_id=$1', [id]);
    await admin.query('DELETE FROM review_cases WHERE customer_id=$1', [id]);
    await admin.query('DELETE FROM customer_screenings WHERE customer_id=$1', [id]);
    await admin.query('DELETE FROM audit_events WHERE customer_id=$1', [id]);
    await admin.query('DELETE FROM customers WHERE id=$1', [id]);
  }
  await admin.end();
});

test('review inbox is tenant-scoped, assigned to an analyst, and closes only after final decisions', async () => {
  const customer = await createCustomer(actor, { name: 'حالة مراجعة اختبارية', entityType: 'company', country: 'AE' });
  customerIds.push(customer.id);
  const screeningId = randomUUID(); screeningIds.push(screeningId);
  const caseId = randomUUID(); caseIds.push(caseId);
  await withTenant(org, async db => {
    await db.query(`INSERT INTO customer_screenings(id,organization_id,customer_id,run_by,overall_band,relevant_count,top_matches)
      VALUES($1,$2,$3,$4,'high',2,$5)`, [screeningId, org, customer.id, actor.id, JSON.stringify([
      { recordId: 'case-record-a', name: 'Case record A', category: 'sanctions', categoryLabel: 'عقوبات' },
      { recordId: 'case-record-b', name: 'Case record B', category: 'pep', categoryLabel: 'PEP' },
    ])]);
    await db.query(`INSERT INTO review_cases(id,organization_id,customer_id,screening_id,priority) VALUES($1,$2,$3,$4,'high')`, [caseId, org, customer.id, screeningId]);
  });
  assert.ok((await listReviewCases(org)).some(item => item.id === caseId));
  assert.equal((await listReviewCases(otherOrg)).some(item => item.id === caseId), false);
  const reviewer = (await listReviewAssignees(org))[0];
  assert.ok(reviewer, 'an active admin or analyst is available for case assignment');
  await assignReviewCase(actor, caseId, reviewer.id, false);
  assert.equal((await listReviewCases(org, { assignee: reviewer.id })).find(item => item.id === caseId)?.status, 'in_review');
  await recordMatchDecision(actor, customer.id, 'case-record-a', 'confirmed', 'identity evidence reviewed');
  assert.ok((await listReviewCases(org)).some(item => item.id === caseId));
  await recordMatchDecision(actor, customer.id, 'case-record-b', 'dismissed', 'not the same legal entity');
  assert.equal((await listReviewCases(org)).some(item => item.id === caseId), false);
  assert.equal(await refreshReviewCasesAfterDecision(org, customer.id, actor.id), 0);
});
