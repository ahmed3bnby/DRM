import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {pool} from '../src/lib/db';
import {searchPublicSources} from '../src/lib/search';
import {createCustomer,listCustomers} from '../src/lib/customers';
const admin=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});const created:string[]=[];
after(async()=>{for(const id of created){await admin.query('DELETE FROM audit_events WHERE customer_id=$1',[id]);await admin.query('DELETE FROM customers WHERE id=$1',[id]);}await admin.end();await pool.end();});
test('reported source name resolves equally with all alef variants and decomposed hamza',async(t)=>{
  // Data-independent: pick a REAL name from the currently-loaded ae_local_terrorists
  // list (instead of a hard-coded entry that may be removed on the next sync), then
  // assert every alef/hamza spelling of it returns the identical exact-match set.
  // If the list is not loaded in this environment, skip rather than fail.
  const picked=await admin.query(`SELECT sn.name FROM source_names sn
    JOIN source_records r ON r.id=sn.record_id
    JOIN source_versions v ON v.id=r.version_id
    WHERE v.code='ae_local_terrorists' AND v.active AND sn.name ~ '[اأإآ]'
    ORDER BY length(sn.name) DESC LIMIT 1`);
  if(!picked.rowCount){t.skip('ae_local_terrorists list not loaded in this environment');return;}
  const base=picked.rows[0].name as string;
  const variants=['ا','أ','إ','آ'].map(f=>base.replace(/[اأإآ]/g,f));
  variants.push(base.replace(/[اأإآ]/g,'أ')); // alef + combining hamza above
  let baseline:string[]|null=null;
  for(const name of variants){
    const r=await searchPublicSources(name);
    const ids=r.filter(x=>x.match_kind==='exact'&&x.code==='ae_local_terrorists').map(x=>x.id).sort();
    assert.ok(ids.length>0,`expected an exact match for spelling variant: ${name}`);
    if(baseline) assert.deepEqual(ids,baseline,`variant "${name}" resolved differently`);
    baseline=ids;
  }
});
test('customer name search ignores alef spelling and diacritics while preserving source name and tenant isolation',async()=>{const actor={id:'20000000-0000-4000-8000-000000000001',organizationId:'10000000-0000-4000-8000-000000000001',role:'admin' as const};const name='أحمد آلاء إيمان اختبار اصطناعي';const {id}=await createCustomer(actor,{name,entityType:'individual',country:'AE'});created.push(id);for(const q of ['أحمد آلاء إيمان','احمد الاء ايمان','آحمد ألاء إيمان','أَحْمَد الاء ايمان']){const rows=await listCustomers(actor.organizationId,q);assert.ok(rows.some(r=>r.id===id&&r.name===name));}assert.equal((await listCustomers('10000000-0000-4000-8000-000000000002','احمد الاء ايمان')).some(r=>r.id===id),false);});
