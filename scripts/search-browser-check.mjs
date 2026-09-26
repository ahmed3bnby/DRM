import {chromium} from '/Users/ahmed/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {Pool} from 'pg';
import assert from 'node:assert/strict';
const db=new Pool({connectionString:process.env.DATABASE_URL});const seed=(await db.query("SELECT r.name FROM source_records r JOIN source_versions v ON v.id=r.version_id WHERE v.active AND v.code='UN' LIMIT 1")).rows[0].name;await db.end();
const b=await chromium.launch({headless:true,channel:'chrome'});const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
await p.goto('http://127.0.0.1:3000/login');await p.getByRole('button',{name:'الدخول إلى مساحة العمل'}).click();await p.waitForURL('http://127.0.0.1:3000/');
await p.goto('http://127.0.0.1:3000/search?q=Microsoft');await p.getByText('بيانات الشركات · GLEIF',{exact:true}).waitFor();assert.ok(await p.locator('.company-result').count()>0);await p.locator('.company-result').first().locator('summary').click();assert.ok(await p.getByText('معرف LEI',{exact:true}).first().isVisible());await p.screenshot({path:'docs/evidence/screenshots/search-companies.png',fullPage:true});
await p.goto('http://127.0.0.1:3000/search?q='+encodeURIComponent(seed));assert.ok(await p.locator('.search-result').count()>0);await p.locator('.search-result').first().click();await p.getByRole('heading',{name:'بيانات السجل المتاحة'}).waitFor();assert.ok((await p.textContent('body')).includes('SHA-256'));
await p.setViewportSize({width:390,height:844});await p.goto('http://127.0.0.1:3000/search');assert.equal(await p.locator('.coverage-row').count(),26);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'docs/evidence/screenshots/search-mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS live GLEIF details, source-backed name search, source detail provenance, 26 coverage rows, mobile width, no page errors');
}finally{await b.close();}
