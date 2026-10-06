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
    await dbAdmin.query(`DELETE FROM review_cases WHERE customer_id = ANY($1::uuid[])`, [cleanupIds]);
    await dbAdmin.query(`DELETE FROM customer_screenings WHERE customer_id = ANY($1::uuid[])`, [cleanupIds]);
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

test('screening never copies identity data from an UNCONFIRMED match into the customer', async (t) => {
  const listed = await dbAdmin.query(`SELECT r.name FROM source_records r JOIN source_versions v ON v.id=r.version_id AND v.active
    WHERE v.code='us_ofac_sdn' AND r.name ~ '^[A-Za-z]+ [A-Za-z]+$' ORDER BY r.name LIMIT 1`);
  if (!listed.rowCount) { t.skip('OFAC SDN not loaded'); return; }
  const { runAndSaveScreening } = await import('../src/lib/screening');
  const { id } = await createCustomer(testActor, { name: listed.rows[0].name, entityType: 'individual', country: 'AE',
    nationality: '', dateOfBirth: '', identifier: '', email: '', industry: '', notes: '', deliveryChannel: 'online' });
  cleanupIds.push(id);
  await runAndSaveScreening({ ...testActor, features: { adverse_media: false } }, id);
  const c = await getCustomer(testActor.organizationId, id);
  assert.ok(!c?.identifier, `identifier was auto-filled: ${c?.identifier}`);
  assert.ok(!c?.nationality, `nationality was auto-filled: ${c?.nationality}`);
  const enriched = await dbAdmin.query(`SELECT 1 FROM audit_events WHERE customer_id=$1 AND action='customer.enriched'`, [id]);
  assert.equal(enriched.rowCount, 0);
});
