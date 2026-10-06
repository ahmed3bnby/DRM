import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {pool} from '../src/lib/db';
import {searchPublicSources,tokenSubsetPatterns} from '../src/lib/search';
import {normalizeName} from '../src/lib/name-normalization';
after(async()=>{await pool.end();});

test('token-subset patterns anchor first/last names and allow middle names',()=>{
  const p=tokenSubsetPatterns('viktor bout')!;
  const re=(s:string)=>new RegExp(s,'u');
  assert.ok(re(p.forward).test('viktor anatolijevitch bout'));
  assert.ok(re(p.reversed).test('bout viktor anatolijevitch'));
  assert.ok(!re(p.forward).test('viktoria bout'));          // whole words only
  assert.ok(!re(p.forward).test('viktor bout ltd'));        // last name must close the name
  assert.equal(tokenSubsetPatterns('madonna'),null);        // single token: trigram path only
  assert.equal(tokenSubsetPatterns('a b'),null);            // 1-char tokens are too noisy
});

test('a query missing the middle name still finds the listed person',async(t)=>{
  // Data-independent: take a real 3-token listed name, drop the middle token, search.
  const picked=await pool.query(`SELECT n.normalized FROM source_names n
    JOIN source_records r ON r.id=n.record_id JOIN source_versions v ON v.id=r.version_id AND v.active
    WHERE n.normalized ~ '^[a-z]{4,} [a-z]{4,} [a-z]{4,}$' ORDER BY n.normalized LIMIT 1`);
  if(!picked.rowCount){t.skip('no source lists loaded in this environment');return;}
  const [first,,last]=String(picked.rows[0].normalized).split(' ');
  const hits=await searchPublicSources(`${first} ${last}`,500);
  const hit=hits.find(h=>normalizeName(h.matched_name)===picked.rows[0].normalized);
  assert.ok(hit,`expected "${picked.rows[0].normalized}" for query "${first} ${last}"`);
  assert.ok(Number(hit.name_similarity)>=0.8);
});

test('phonetic key joins Arabic compound names the same way in both scripts',async()=>{
  const {phoneticKey:p}=await import('../src/lib/name-normalization');
  const same:[string,string][]=[['حسن نصر الله','Hasan NASRALLAH'],['حسن نصر الله','Hassan Nasr Allah'],
    ['عبد الكريم','Abd al-Karim'],['عبد الكريم','Abdulkarim'],['عبد الله','Abdullah'],
    ['أبو بكر البغدادي','Abubakar Al Baghdadi'],['بشار الأسد','Bashar al-Assad'],
    ['محمد بن سلمان','Muhammad ibn Salman'],['خليفة بن زايد آل نهيان','Khalifa bin Zayed Al Nahyan']];
  for(const [ar,la] of same) assert.equal(p(ar),p(la),`${ar} ↔ ${la}`);
});

test('prefix pattern needs 3+ names; reversed order with extra names is not a strong match',()=>{
  assert.equal(tokenSubsetPatterns('viktor bout')!.prefix,null);
  const re=new RegExp(tokenSubsetPatterns('mohammed bin salman')!.prefix!,'u');
  assert.ok(re.test('mohammed bin salman bin abd al aziz al saud'));
  assert.ok(!re.test('mohammed bin salman'));                 // exact is handled by similarity
});

test('Arabic-script query finds the Latin-listed person (cross-script) as a reviewable match',async(t)=>{
  const listed=await pool.query(`SELECT 1 FROM source_names n JOIN source_records r ON r.id=n.record_id
    JOIN source_versions v ON v.id=r.version_id AND v.active WHERE n.normalized='hasan nasrallah' LIMIT 1`);
  if(!listed.rowCount){t.skip('Nasrallah not in the loaded lists');return;}
  const hits=await searchPublicSources('حسن نصر الله',500);
  assert.ok(hits.some(h=>/nasrallah/i.test(h.matched_name)&&Number(h.name_similarity)>=0.8));
});

test('common two-word names do not flood the analyst with phonetic look-alikes',async(t)=>{
  const any=await pool.query(`SELECT 1 FROM source_versions WHERE active LIMIT 1`);
  if(!any.rowCount){t.skip('no lists loaded');return;}
  for(const q of ['Mohamed Ahmed','محمد أحمد']){
    const strong=(await searchPublicSources(q,500)).filter(h=>Number(h.name_similarity)>=0.8).length;
    assert.ok(strong<=40,`${q}: ${strong} candidates ≥80% (Mahmoud/Hamed look-alikes leaking in?)`);
  }
});
