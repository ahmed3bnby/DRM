import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../src/lib/db';
import {normalizeName} from '../src/lib/name-normalization';
import {searchCoverage,searchPublicSources,getSourceRecord} from '../src/lib/search';
after(()=>pool.end());
test('Arabic normalization preserves letters while removing diacritics and punctuation',()=>{assert.equal(normalizeName(' أَحْمَد  ـ عليّ '),'احمد علي');assert.equal(normalizeName('Test, COMPANY'),'test company');});
test('source-backed search returns a real imported record and immutable provenance',async()=>{const coverage=await searchCoverage();assert.ok(coverage.some(s=>s.code==='UN'));const r=await pool.query("SELECT r.name,r.id FROM source_records r JOIN source_versions v ON v.id=r.version_id WHERE v.code='UN' AND v.active LIMIT 1");const results=await searchPublicSources(r.rows[0].name);assert.ok(results.some(s=>s.id===r.rows[0].id&&s.match_kind==='exact'));const detail=await getSourceRecord(r.rows[0].id);assert.equal(detail?.sha256.length,64);assert.ok(detail?.details);});
test('no match does not fabricate a record; SQL metacharacters harmless',async()=>{assert.equal((await searchPublicSources('zzzxqvnonexistent999999')).length,0);assert.deepEqual(await searchPublicSources(''),[]);await searchPublicSources("'; DROP TABLE source_records; --");assert.ok((await searchCoverage()).length>0);});
