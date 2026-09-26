import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  createCustomer,
  updateCustomer,
  getCustomer,
  listCustomers,
  countCustomers,
  getStats,
  deleteCustomer
} from '../src/lib/customers';
import { clearUserSearches, consumeSearch } from '../src/lib/team';
import { recordMatchDecision } from '../src/lib/decisions';
import { screenCustomer } from '../src/lib/screening';
import { assignReviewCase } from '../src/lib/review-cases';

const org = '10000000-0000-4000-8000-000000000001';
const dbAdmin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

const adminActor = { id: '20000000-0000-4000-8000-000000000001', organizationId: org, role: 'admin' as const };
const analyst1Id = randomUUID();
const analyst2Id = randomUUID();
const viewerId = randomUUID();
const analyst1Actor = { id: analyst1Id, organizationId: org, role: 'analyst' as const };
const analyst2Actor = { id: analyst2Id, organizationId: org, role: 'analyst' as const };
const viewerActor = { id: viewerId, organizationId: org, role: 'viewer' as const };

const createdCustomerIds: string[] = [];

async function cleanupTestData() {
  const emails = ['analyst-b1@test.local', 'analyst-b2@test.local', 'viewer-b@test.local'];
  await dbAdmin.query('DELETE FROM match_decisions WHERE customer_id IN (SELECT id FROM customers WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1::text[])))', [emails]);
  await dbAdmin.query('DELETE FROM review_cases WHERE customer_id IN (SELECT id FROM customers WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1::text[])))', [emails]);
  await dbAdmin.query('DELETE FROM customer_screenings WHERE customer_id IN (SELECT id FROM customers WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1::text[])))', [emails]);
  await dbAdmin.query('DELETE FROM audit_events WHERE customer_id IN (SELECT id FROM customers WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1::text[])))', [emails]);
  await dbAdmin.query('DELETE FROM customers WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1::text[]))', [emails]);

  for (const id of createdCustomerIds) {
    await dbAdmin.query('DELETE FROM match_decisions WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM review_cases WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM customer_screenings WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM audit_events WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM customers WHERE id=$1', [id]);
  }
  await dbAdmin.query('DELETE FROM search_events WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))', [emails]);
  await dbAdmin.query('DELETE FROM audit_events WHERE actor_id IN (SELECT id FROM users WHERE email = ANY($1::text[]))', [emails]);
  await dbAdmin.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);
}

before(async () => {
  await cleanupTestData();

  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota)
    VALUES
      ($1, $4, 'analyst-b1', 'analyst-b1@test.local', 'محلل العزل الأول', 'analyst', 'hash', 100),
      ($2, $4, 'analyst-b2', 'analyst-b2@test.local', 'محلل العزل الثاني', 'analyst', 'hash', 100),
      ($3, $4, 'viewer-b', 'viewer-b@test.local', 'المدقق الرقابي', 'viewer', 'hash', 50)
    ON CONFLICT (id) DO NOTHING
  `, [analyst1Id, analyst2Id, viewerId, org]);
});

after(async () => {
  await cleanupTestData();
  await dbAdmin.end();
});

test('Model B: Customer data and statistics strict isolation', async () => {
  // 1. Analyst 1 creates Customer A
  const custA = await createCustomer(analyst1Actor, {
    name: 'شركة العزل الأولى',
    entityType: 'company',
    country: 'AE',
    notes: 'خاص بالمحلل الأول فقط'
  });
  createdCustomerIds.push(custA.id);

  // 2. Analyst 2 creates Customer B
  const custB = await createCustomer(analyst2Actor, {
    name: 'مؤسسة العزل الثانية',
    entityType: 'company',
    country: 'SA',
    notes: 'خاص بالمحلل الثاني فقط'
  });
  createdCustomerIds.push(custB.id);

  // 3. Verify listCustomers isolation
  const listA = await listCustomers(org, '', '', { actorId: analyst1Id });
  assert.ok(listA.some(c => c.id === custA.id), 'Analyst 1 must see Cust A');
  assert.ok(!listA.some(c => c.id === custB.id), 'Analyst 1 must NOT see Cust B');

  const listB = await listCustomers(org, '', '', { actorId: analyst2Id });
  assert.ok(listB.some(c => c.id === custB.id), 'Analyst 2 must see Cust B');
  assert.ok(!listB.some(c => c.id === custA.id), 'Analyst 2 must NOT see Cust A');

  // Admin sees both
  const listAdmin = await listCustomers(org);
  assert.ok(listAdmin.some(c => c.id === custA.id), 'Admin must see Cust A');
  assert.ok(listAdmin.some(c => c.id === custB.id), 'Admin must see Cust B');

  // 4. Verify getStats isolation
  const statsA = await getStats(org, analyst1Id);
  const statsB = await getStats(org, analyst2Id);
  const statsAdmin = await getStats(org);

  assert.equal(statsA.total, 1, 'Analyst 1 total stats should count only their own 1 customer');
  assert.equal(statsB.total, 1, 'Analyst 2 total stats should count only their own 1 customer');
  assert.ok(statsAdmin.total >= 2, 'Admin stats count all customers across organization');

  // 5. Verify direct getCustomer lookup isolation
  const fetchOwnA = await getCustomer(org, custA.id, analyst1Id);
  assert.ok(fetchOwnA, 'Analyst 1 can fetch their own customer');

  const fetchOtherA = await getCustomer(org, custA.id, analyst2Id);
  assert.equal(fetchOtherA, null, 'Analyst 2 cannot fetch Analyst 1 customer');

  const fetchAdminA = await getCustomer(org, custA.id, undefined);
  assert.ok(fetchAdminA, 'Admin can fetch any customer');
});

test('Model B: Admin deletion capabilities and non-admin restriction', async () => {
  const custToDelete = await createCustomer(analyst1Actor, {
    name: 'عميل مراد حذفه',
    entityType: 'individual',
    country: 'EG',
    notes: 'سيتم حذفه بواسطة الأدمن'
  });
  createdCustomerIds.push(custToDelete.id);

  // 1. Non-admin attempting to delete customer must be rejected
  await assert.rejects(
    async () => {
      await deleteCustomer(analyst1Actor, custToDelete.id);
    },
    { message: 'FORBIDDEN' }
  );

  // 2. Admin deletes customer
  await deleteCustomer(adminActor, custToDelete.id);

  // Verify customer is gone
  const lookupDeleted = await getCustomer(org, custToDelete.id);
  assert.equal(lookupDeleted, null, 'Deleted customer must not exist in DB');

  // 3. Search clearance testing
  await consumeSearch(analyst1Actor, 'query:test-deletion-term');
  const userCheckBefore = await dbAdmin.query('SELECT count(*) FROM search_events WHERE user_id = $1', [analyst1Id]);
  assert.ok(Number(userCheckBefore.rows[0].count) >= 1, 'Should have recorded search event');

  // Non-admin attempting to clear searches must fail
  await assert.rejects(
    async () => {
      await clearUserSearches(analyst2Actor, analyst1Id);
    },
    { message: 'FORBIDDEN' }
  );

  // Admin clearing searches succeeds
  await clearUserSearches(adminActor, analyst1Id);
  const userCheckAfter = await dbAdmin.query('SELECT count(*) FROM search_events WHERE user_id = $1', [analyst1Id]);
  assert.equal(Number(userCheckAfter.rows[0].count), 0, 'Search events must be 0 after admin clearance');
});

test('Security & IDOR: Non-creator analyst cannot decide matches or screen another analyst customer', async () => {
  const custA = await createCustomer(analyst1Actor, {
    name: 'عميل محمي من التعديل والمطابقات',
    entityType: 'individual',
    country: 'AE',
    notes: 'تابع للمحلل الأول'
  });
  createdCustomerIds.push(custA.id);

  // 1. Analyst 2 screening Analyst 1 customer must be rejected (NOT_FOUND)
  await assert.rejects(
    async () => {
      await screenCustomer(analyst2Actor, custA.id);
    },
    { message: 'NOT_FOUND' }
  );

  // 2. Analyst 1 can screen their own customer
  const screened = await screenCustomer(analyst1Actor, custA.id);
  assert.ok(screened.customer, 'Analyst 1 can screen own customer');

  // 3. Analyst 2 deciding on Analyst 1 match must be rejected (FORBIDDEN_NOT_CREATOR)
  await assert.rejects(
    async () => {
      await recordMatchDecision(analyst2Actor, custA.id, 'dummy-record-1', 'confirmed', 'محاولة غير مصرح بها');
    },
    { message: 'FORBIDDEN_NOT_CREATOR' }
  );

  // 4. Analyst 1 deciding on their own customer succeeds
  await recordMatchDecision(analyst1Actor, custA.id, 'dummy-record-1', 'dismissed', 'مستبعد بواسطة المحلل المنشئ');

  // 5. Admin can also decide on any customer
  await recordMatchDecision(adminActor, custA.id, 'dummy-record-1', 'confirmed', 'قرار إداري معتمد');
});

test('Auditor (Viewer): Read-only audit access across firm, absolute block on all mutations', async () => {
  // 1. Customer created by analyst
  const cust = await createCustomer(analyst1Actor, {
    name: 'شركة التدقيق والامتثال الشامل',
    entityType: 'company',
    country: 'AE',
    notes: 'ملف خاضع للتدقيق والمراجعة'
  });
  createdCustomerIds.push(cust.id);

  // 2. Viewer can view customer list when actorId is undefined (viewer scoping)
  const listViewer = await listCustomers(org);
  assert.ok(listViewer.some(c => c.id === cust.id), 'Auditor/Viewer can view customer list across firm');

  // 3. Viewer can view individual customer profile
  const fetchCust = await getCustomer(org, cust.id);
  assert.ok(fetchCust, 'Auditor/Viewer can fetch customer profile');

  // 4. Viewer cannot create customer
  await assert.rejects(
    async () => {
      await createCustomer(viewerActor, {
        name: 'محاولة إنشاء بواسطة المدقق',
        entityType: 'individual',
        country: 'AE'
      });
    },
    { message: 'FORBIDDEN' }
  );

  // 5. Viewer cannot update customer
  await assert.rejects(
    async () => {
      await updateCustomer(viewerActor, cust.id, {
        name: 'محاولة تعديل بواسطة المدقق',
        entityType: 'company',
        country: 'AE'
      });
    },
    { message: 'FORBIDDEN' }
  );

  // 6. Viewer cannot delete customer
  await assert.rejects(
    async () => {
      await deleteCustomer(viewerActor, cust.id);
    },
    { message: 'FORBIDDEN' }
  );

  // 7. Viewer cannot screen customer
  await assert.rejects(
    async () => {
      await screenCustomer(viewerActor, cust.id);
    },
    { message: 'FORBIDDEN' }
  );

  // 8. Viewer cannot record match decision
  await assert.rejects(
    async () => {
      await recordMatchDecision(viewerActor, cust.id, 'dummy-rec', 'confirmed', 'محاولة قرار بواسطة مدقق');
    },
    { message: 'FORBIDDEN' }
  );

  // 9. Viewer cannot claim or assign review case
  await assert.rejects(
    async () => {
      await assignReviewCase(viewerActor, 'dummy-case-id', null, true);
    },
    { message: 'FORBIDDEN' }
  );
});
