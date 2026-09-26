import {chromium} from '/Users/ahmed/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const db=new Pool({connectionString:process.env.DATABASE_URL});
const versions=(await db.query('SELECT code,record_count,parser_version FROM source_versions WHERE active ORDER BY code')).rows;
const rich=versions.filter(v=>v.parser_version==='os-rich-1.0');assert.equal(rich.length,25);
const seed=(await db.query(`SELECT r.id,r.name FROM source_records r JOIN source_versions v ON v.id=r.version_id WHERE v.active AND v.code='ae_local_terrorists' AND r.details ? 'sanctions' AND r.details ? 'addressEntity' LIMIT 1`)).rows[0];assert.ok(seed);
const canada=(await db.query(`SELECT r.name FROM source_records r JOIN source_versions v ON v.id=r.version_id WHERE v.active AND v.code='ca_dfatd_sema_sanctions' ORDER BY length(r.name) DESC LIMIT 1`)).rows[0];
await db.end();
const browser=await chromium.launch({headless:true,channel:'chrome'});const p=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('http://127.0.0.1:3000/login');await p.getByRole('button',{name:'الدخول إلى مساحة العمل'}).click();await p.waitForURL('http://127.0.0.1:3000/');
 await p.goto('http://127.0.0.1:3000/sources');await p.getByRole('heading',{name:'تغطية المصادر المطلوبة'}).waitFor();assert.equal(await p.locator('table').first().locator('tbody tr').count(),26);assert.ok((await p.textContent('body')).includes('تغطية جزئية'));
 await p.goto('http://127.0.0.1:3000/search?q='+encodeURIComponent(canada.name));assert.ok(await p.locator('.search-result').count()>0);
 await p.goto('http://127.0.0.1:3000/search/'+seed.id);await p.getByRole('heading',{name:'سلسلة مصدر البيانات'}).waitFor();assert.ok((await p.textContent('body')).includes('SHA-256'));assert.ok(!(await p.textContent('body')).includes('[object Object]'));assert.ok(await p.locator('.record-relation').count()>0);
 await p.locator('.record-relation summary').first().click();assert.ok(await p.locator('.record-relation[open]').count()>0);
 await mkdir('docs/evidence/screenshots',{recursive:true});await p.screenshot({path:'docs/evidence/screenshots/rich-source-desktop.png',fullPage:true});
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'docs/evidence/screenshots/rich-source-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 await writeFile('docs/evidence/rich-source-check.json',JSON.stringify({checkedAt:new Date().toISOString(),activeLists:versions.length,richLists:rich.length,totalSnapshotRecords:versions.reduce((s,v)=>s+v.record_count,0),versions,checks:['requested coverage visible','Canada searchable','nested evidence renders','mobile no overflow','no browser errors']},null,2));
 console.log('PASS: 25 rich lists; source coverage, Canada search, nested source detail, evidence and mobile layout');
}finally{await browser.close();}
