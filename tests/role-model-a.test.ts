import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { createCustomer, updateCustomer, getCustomer, getActivity } from '../src/lib/customers';

const org = '10000000-0000-4000-8000-000000000001';
const dbAdmin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

const adminActor = { id: '20000000-0000-4000-8000-000000000001', organizationId: org, role: 'admin' as const };
const analyst1Id = randomUUID();
const analyst2Id = randomUUID();
const analyst1Actor = { id: analyst1Id, organizationId: org, role: 'analyst' as const };
const analyst2Actor = { id: analyst2Id, organizationId: org, role: 'analyst' as const };

const customerIds: string[] = [];

before(async () => {
  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota)
    VALUES
      ($1, $3, 'analyst1-test', 'analyst1@test.local', 'المحلل الأول', 'analyst', 'hash', 100),
      ($2, $3, 'analyst2-test', 'analyst2@test.local', 'المحلل الثاني', 'analyst', 'hash', 100)
    ON CONFLICT (id) DO NOTHING
  `, [analyst1Id, analyst2Id, org]);
});

after(async () => {
  for (const id of customerIds) {
    await dbAdmin.query('DELETE FROM audit_events WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM customers WHERE id=$1', [id]);
  }
  await dbAdmin.query('DELETE FROM audit_events WHERE actor_id = ANY($1::uuid[])', [[analyst1Id, analyst2Id]]);
  await dbAdmin.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[analyst1Id, analyst2Id]]);
  await dbAdmin.end();
});

test('Model A: Creator ownership & editing permissions', async () => {
  // 1. Analyst 1 creates a customer
  const created = await createCustomer(analyst1Actor, {
    name: 'شركة الاستيراد المتحدة',
    entityType: 'company',
    country: 'AE',
    notes: 'سجل أولي بواسطة المحلل الأول'
  });
  customerIds.push(created.id);

  // 2. Fetch customer and verify created_by and creator_name
  const fetched = await getCustomer(org, created.id);
  assert.ok(fetched);
  assert.equal(fetched.created_by, analyst1Id);
  assert.equal(fetched.creator_name, 'المحلل الأول');

  // 3. Analyst 2 tries to update Analyst 1's customer -> Must be rejected with FORBIDDEN_NOT_CREATOR
  await assert.rejects(
    async () => {
      await updateCustomer(analyst2Actor, created.id, {
        name: 'شركة الاستيراد المتحدة المعدلة',
        entityType: 'company',
        country: 'AE',
        notes: 'محاولة تعديل غير مصرح بها من محلل آخر'
      });
    },
    { message: 'FORBIDDEN_NOT_CREATOR' }
  );

  // 4. Analyst 1 updates their own customer -> Succeeds
  const ref1 = await updateCustomer(analyst1Actor, created.id, {
    name: 'شركة الاستيراد المتحدة المحدثة',
    entityType: 'company',
    country: 'AE',
    notes: 'تعديل مشروع من قبل منشئ الملف'
  });
  assert.equal(ref1, created.reference);

  // Verify the update took effect
  const updated1 = await getCustomer(org, created.id);
  assert.equal(updated1?.name, 'شركة الاستيراد المتحدة المحدثة');

  // 5. Admin updates the customer created by Analyst 1 -> Succeeds
  const refAdmin = await updateCustomer(adminActor, created.id, {
    name: 'شركة الاستيراد المتحدة - مراجعة المدير',
    entityType: 'company',
    country: 'AE',
    notes: 'تحديث معتمد من مدير النظام'
  });
  assert.equal(refAdmin, created.reference);

  const updatedAdmin = await getCustomer(org, created.id);
  assert.equal(updatedAdmin?.name, 'شركة الاستيراد المتحدة - مراجعة المدير');
});

test('Model A: Personal activity isolation in getActivity', async () => {
  // Analyst 1 activity should only show Analyst 1's events
  const a1Activity = await getActivity(org, undefined, analyst1Id);
  assert.ok(a1Activity.length > 0);
  assert.ok(a1Activity.every(a => (a as any).actor_id === analyst1Id));

  // Analyst 2 activity should not contain Analyst 1's creation/update events
  const a2Activity = await getActivity(org, undefined, analyst2Id);
  assert.equal(a2Activity.some(a => (a as any).actor_id === analyst1Id), false);

  // Global activity (no actorId passed, as used by Admin) returns all events
  const globalActivity = await getActivity(org);
  assert.ok(globalActivity.some(a => (a as any).actor_id === analyst1Id));
});
