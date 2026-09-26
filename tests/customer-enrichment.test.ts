import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { createCustomer, enrichCustomerFromMatch, getCustomer } from '../src/lib/customers';
import { requireActor } from '../src/lib/auth';

const testActor = {
  id: '20000000-0000-4000-8000-000000000001',
  organizationId: '10000000-0000-4000-8000-000000000001',
  role: 'analyst' as const
};

const cleanupIds: string[] = [];
const dbAdmin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

after(async () => {
  if (cleanupIds.length > 0) {
    await dbAdmin.query(`DELETE FROM audit_events WHERE customer_id = ANY($1::uuid[])`, [cleanupIds]);
    await dbAdmin.query(`DELETE FROM customers WHERE id = ANY($1::uuid[]) OR name IN ('Auto Enrich Individual Test', 'Preserve Data Test')`, [cleanupIds]);
  }
  await dbAdmin.end();
});



test('enrichCustomerFromMatch auto-populates missing fields from match record', async () => {
  const { id } = await createCustomer(testActor, {
    name: 'Auto Enrich Individual Test',
    entityType: 'individual',
    country: 'OTHER',
    nationality: '',
    deliveryChannel: 'online',
    email: '',
    industry: '',
    dateOfBirth: '',
    identifier: '',
    notes: 'Draft customer awaiting auto enrichment'
  });
  cleanupIds.push(id);

  const res = await enrichCustomerFromMatch(testActor.organizationId, testActor.id, id, {
    country: 'pk',
    dob: '1989-10-20',
    identifier: 'interpol-red-2018-71641',
    sourceName: 'INTERPOL Red Notices'
  });

  assert.equal(res.enriched, true);
  assert.equal(res.fields.country, 'PK');
  assert.equal(res.fields.nationality, 'PK');
  assert.equal(res.fields.date_of_birth, '1989-10-20');
  assert.equal(res.fields.identifier, 'interpol-red-2018-71641');

  const updated = await getCustomer(testActor.organizationId, id);
  assert.ok(updated);
  assert.equal(updated.country, 'PK');
  assert.equal(updated.nationality, 'PK');
  assert.equal(updated.date_of_birth, '1989-10-20');
  assert.equal(updated.identifier, 'interpol-red-2018-71641');
});

test('enrichCustomerFromMatch preserves existing valid user data and never overwrites it', async () => {
  const { id } = await createCustomer(testActor, {
    name: 'Preserve Data Test',
    entityType: 'individual',
    country: 'EG',
    nationality: 'EG',
    deliveryChannel: 'face_to_face',
    email: 'user@example.com',
    industry: 'Trading',
    dateOfBirth: '1980-01-01',
    identifier: 'PASSPORT-ORIGINAL-999',
    notes: 'Pre-existing complete customer profile'
  });
  cleanupIds.push(id);


  const res = await enrichCustomerFromMatch(testActor.organizationId, testActor.id, id, {
    country: 'sy',
    dob: '1995-05-05',
    identifier: 'DIFFERENT-ID-111',
    sourceName: 'UN Sanctions List'
  });

  assert.equal(res.enriched, false);
  assert.deepEqual(res.fields, {});

  const after = await getCustomer(testActor.organizationId, id);
  assert.ok(after);
  assert.equal(after.country, 'EG');
  assert.equal(after.nationality, 'EG');
  assert.equal(after.date_of_birth, '1980-01-01');
  assert.equal(after.identifier, 'PASSPORT-ORIGINAL-999');
});
