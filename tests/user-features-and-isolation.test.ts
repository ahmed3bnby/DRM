import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { getReviewQueueStats, listReviewCases, countReviewCases } from '../src/lib/review-cases';
import { consumeSearch, getRecentSearches, clearMySearchHistory, countSearchHistory, listSearchHistory, getSearchHistoryStats, removeSearchHistoryItem } from '../src/lib/team';
import { createCustomer, getCustomer } from '../src/lib/customers';

const org = '10000000-0000-4000-8000-000000000001';
const dbAdmin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });

const testUserId = randomUUID();
const testActor = { id: testUserId, organizationId: org, role: 'analyst' as const };

const cleanUpCustomerIds: string[] = [];

before(async () => {
  await dbAdmin.query('DELETE FROM search_events WHERE user_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await dbAdmin.query(`
    INSERT INTO users(id, organization_id, username, email, display_name, role, password_hash, search_quota)
    VALUES ($1, $2, 'test-iso-user', 'test-iso@test.local', 'محلل فحص العزل', 'analyst', 'hash', 100)
    ON CONFLICT (id) DO NOTHING
  `, [testUserId, org]);
});

after(async () => {
  for (const id of cleanUpCustomerIds) {
    await dbAdmin.query('DELETE FROM match_decisions WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM review_cases WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM customer_screenings WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM audit_events WHERE customer_id=$1', [id]);
    await dbAdmin.query('DELETE FROM customers WHERE id=$1', [id]);
  }
  await dbAdmin.query('DELETE FROM search_events WHERE user_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM audit_events WHERE actor_id = $1', [testUserId]);
  await dbAdmin.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await dbAdmin.end();
});

test('Review queue stats and list strictly isolated to user with zero leakage', async () => {
  // 1. Verify getReviewQueueStats for user who has no cases returns zeros across the board
  const stats = await getReviewQueueStats(org, testUserId);
  assert.equal(stats.open, 0, 'Open cases must be 0 for user with no assigned cases');
  assert.equal(stats.inReview, 0, 'In review cases must be 0');
  assert.equal(stats.high, 0, 'High priority cases must be 0');
  assert.equal(stats.unassigned, 0, 'Unassigned must be 0 for non-admin');

  // 2. Verify listReviewCases and countReviewCases return 0 cases for this user
  const count = await countReviewCases(org, { actorId: testUserId });
  assert.equal(count, 0, 'Case count must be 0 for user with no assigned cases');

  const cases = await listReviewCases(org, { actorId: testUserId });
  assert.equal(cases.length, 0, 'Review cases list must be empty for user with no cases');
});

test('Search history: records queries, returns recent searches, and clears history', async () => {
  // 1. Perform searches with rawQuery
  await consumeSearch(testActor, 'query:al haram exchange', 'AL HARAM EXCHANGE');
  await consumeSearch(testActor, 'query:east turkistan', 'East Turkistan');

  // 2. Fetch recent searches
  const recents = await getRecentSearches(testActor);
  assert.ok(recents.length >= 2, 'Should have at least 2 recent searches');
  assert.equal(recents[0].query, 'East Turkistan', 'Most recent search should be first');
  assert.equal(recents[1].query, 'AL HARAM EXCHANGE');

  // 3. Clear search history
  await clearMySearchHistory(testActor);
  const recentsAfterClear = await getRecentSearches(testActor);
  assert.equal(recentsAfterClear.length, 0, 'Recent searches must be empty after clear');
});

test('Search history: pagination, stats, single item deletion, and filtering', async () => {
  // 1. Clean previous searches for test user
  await clearMySearchHistory(testActor);

  // 2. Perform 3 distinct searches
  await consumeSearch(testActor, 'query:al haram exchange', 'AL HARAM EXCHANGE');
  await consumeSearch(testActor, 'query:taher aly', 'Taher Aly');
  await consumeSearch(testActor, 'query:sohail munir', 'Sohail Munir');

  // 3. Stats check
  const stats = await getSearchHistoryStats(testActor);
  assert.equal(stats.totalQueries, 3, 'Should have 3 distinct queries');
  assert.ok(stats.totalRuns >= 3, 'Total runs should be at least 3');
  assert.ok(stats.todayRuns >= 3, 'Today runs should be at least 3');
  assert.ok(stats.lastSearchAt instanceof Date, 'lastSearchAt must be a valid Date');

  // 4. Pagination check: page size 2, offset 0 -> 2 items; offset 2 -> 1 item
  const page1 = await listSearchHistory(testActor, { limit: 2, offset: 0 });
  assert.equal(page1.length, 2, 'Page 1 must have 2 items');

  const page2 = await listSearchHistory(testActor, { limit: 2, offset: 2 });
  assert.equal(page2.length, 1, 'Page 2 must have 1 item');

  // 5. Filter check: filtering by "taher"
  const filteredCount = await countSearchHistory(testActor, 'taher');
  assert.equal(filteredCount, 1, 'Filtered count for "taher" should be 1');
  const filteredList = await listSearchHistory(testActor, { limit: 10, offset: 0, filter: 'taher' });
  assert.equal(filteredList.length, 1);
  assert.equal(filteredList[0].query, 'Taher Aly');

  // 6. Delete single item "Taher Aly"
  await removeSearchHistoryItem(testActor, 'Taher Aly');
  const countAfterDelete = await countSearchHistory(testActor);
  assert.equal(countAfterDelete, 2, 'Count should be 2 after deleting 1 item');
  const listAfterDelete = await listSearchHistory(testActor, { limit: 10, offset: 0, filter: 'taher' });
  assert.equal(listAfterDelete.length, 0, 'Taher should no longer be in history');

  // 7. Clean up
  await clearMySearchHistory(testActor);
});


test('Customer creation from source record attaches customer to current actor', async () => {
  const newCust = await createCustomer(testActor, {
    name: 'AL HARAM EXCHANGE - TEST IMPORT',
    entityType: 'company',
    country: 'AE',
    notes: 'تم استيراد هذا العميل آلياً من سجل المصادر'
  });
  cleanUpCustomerIds.push(newCust.id);

  const fetched = await getCustomer(org, newCust.id);
  assert.ok(fetched);
  assert.equal(fetched.created_by, testUserId, 'Customer created_by must belong to current user');
  assert.equal(fetched.name, 'AL HARAM EXCHANGE - TEST IMPORT');
});
