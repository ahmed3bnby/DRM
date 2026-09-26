import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSourceUrl,detailGroup,extractRecordCountry,extractRecordDob,extractRecordIdentifier,extractRecordAliases} from '../src/lib/record-details';
import {coverageStatus} from '../src/lib/source-catalog';
test('evidence links allow only web links without embedded credentials',()=>{
 assert.equal(safeSourceUrl('javascript:alert(1)'),null);
 assert.equal(safeSourceUrl('data:text/html,test'),null);
 assert.equal(safeSourceUrl('https://user:secret@example.org'),null);
 assert.equal(safeSourceUrl('https://example.org/evidence'),'https://example.org/evidence');
});
test('source coverage distinguishes incomplete groups and unsupported providers',()=>{
 assert.equal(coverageStatus({codes:['a','b']},new Set(['a'])),'partial');
 assert.equal(coverageStatus({codes:['a'],partial:true},new Set(['a'])),'partial');
 assert.equal(coverageStatus({codes:[]},new Set(['a'])),'notLinked');
 assert.equal(coverageStatus({codes:['a']},new Set(['a'])),'inScope');
});
test('relationship fields and source evidence have distinct sections',()=>{
 assert.equal(detailGroup('ownershipOwner'),'relations');
 assert.equal(detailGroup('sanctions'),'listing');
 assert.equal(detailGroup('sourceUrl'),'addresses');
});
test('extractRecordCountry extracts valid country codes from diverse schema formats',()=>{
 assert.equal(extractRecordCountry({country: ['AE']}), 'AE');
 assert.equal(extractRecordCountry({countries: ['sy', 'lb']}), 'SY');
 assert.equal(extractRecordCountry({nationality: 'EG'}), 'EG');
 assert.equal(extractRecordCountry({nationality: ['Sudanese']}), 'SD');
 assert.equal(extractRecordCountry({country: 'Pakistan'}), 'PK');
 assert.equal(extractRecordCountry({NATIONALITY: ['باكستان']}), 'PK');
 assert.equal(extractRecordCountry({}), null);
});
test('extractRecordDob extracts birth or founding dates',()=>{
 assert.equal(extractRecordDob({birthDate: ['1975-04-12']}), '1975-04-12');
 assert.equal(extractRecordDob({incorporationDate: '2010'}), '2010');
 assert.equal(extractRecordDob({}), null);
});
test('extractRecordIdentifier extracts passport or legal ID',()=>{
 assert.equal(extractRecordIdentifier({passportNumber: ['N1234567']}), 'N1234567');
 assert.equal(extractRecordIdentifier({identification: [{number: 'ID-9988'}]}), 'ID-9988');
 assert.equal(extractRecordIdentifier({}, 'Q12345'), 'Q12345');
 assert.equal(extractRecordIdentifier({}, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'), null);
});
test('extractRecordAliases collects distinct aliases including original script',()=>{
 const res = extractRecordAliases({
  name: 'John Doe',
  aliases: ['Johnny', 'John Doe'],
  details: { alias: ['J. Doe'], NAME_ORIGINAL_SCRIPT: 'جون دو' }
 });
 assert.deepEqual(res, ['Johnny', 'J. Doe', 'جون دو']);
});

