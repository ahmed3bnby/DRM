import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {normalizeName} from '../src/lib/name-normalization';
if(process.env.APP_ENV!=='local')throw Error('Local migration only');
const db=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});const c=await db.connect();
try{await c.query('BEGIN');await c.query(await readFile('db/005_customer_search.sql','utf8'));const rows=await c.query('SELECT id,name,normalized_name FROM customers');let changed=0;for(const r of rows.rows){const name=normalizeName(r.name);if(name!==r.normalized_name){await c.query('UPDATE customers SET normalized_name=$2 WHERE id=$1',[r.id,name]);changed++;}}await c.query('COMMIT');console.log('Customer search keys updated:',changed);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}
