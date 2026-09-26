import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
test('a concurrent sync runner exits before fetching or changing job history',async()=>{
 const db=new Pool({connectionString:process.env.DATABASE_ADMIN_URL,max:1});const c=await db.connect();
 try{await c.query("SELECT pg_advisory_lock(hashtext('nbn-source-sync-runner'))");
 await assert.rejects(promisify(execFile)(process.execPath,['scripts/sync-runner.mjs'],{timeout:10000}),e=>{const err=e as {code:number;stdout:string};return err.code===2&&err.stdout.includes('already running');});
 }finally{await c.query("SELECT pg_advisory_unlock(hashtext('nbn-source-sync-runner'))");c.release();await db.end();}
});
