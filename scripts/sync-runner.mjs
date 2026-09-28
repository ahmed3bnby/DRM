// Local durable job history shared by manual and scheduled syncs.
import {mkdir,readFile,writeFile,rename,rm,open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
for(const p of['.env.production.local','.env.local','.env']){try{process.loadEnvFile(p);if(process.env.DATABASE_ADMIN_URL)break;}catch{}}
if(process.env.APP_ENV!=='local')throw Error('Local runner only');
await mkdir('.local',{recursive:true});
// PostgreSQL releases this lock automatically even after a process crash.
const guard=new Pool({connectionString:process.env.DATABASE_ADMIN_URL,max:1});
const connection=await guard.connect();
const acquired=(await connection.query("SELECT pg_try_advisory_lock(hashtext('nbn-source-sync-runner')) AS locked")).rows[0].locked;
if(!acquired){connection.release();await guard.end();console.log('Sync already running');process.exit(2);}
const run={id:randomUUID(),pid:process.pid,trigger:process.argv.includes('--scheduled')?'scheduled':'manual',actorId:process.env.SYNC_ACTOR_ID||null,startedAt:new Date().toISOString(),finishedAt:null,status:'running',added:0,removed:0,imported:0,unchanged:0};

let history=[];try{history=JSON.parse(await readFile('.local/sync-runs.json','utf8'));}catch{}
history=history.map(r=>r.status==='running'?{...r,status:'interrupted'}:r);
history=[run,...history].slice(0,50);
const save=async()=>{await writeFile('.local/sync-runs.tmp',JSON.stringify(history));await rename('.local/sync-runs.tmp','.local/sync-runs.json');};
let log;
try{
 await save();log=await open('.local/sync-worker.log','a');
 const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/sync.mjs',...(process.argv.includes('--all')?[]:['--changed-only'])],{stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('close',resolve);});
 run.status=exit===0?'success':'failed';run.exitCode=exit;
 const db=new Pool({connectionString:process.env.DATABASE_ADMIN_URL});
 try{const {rows}=await db.query(`SELECT coalesce(sum(added),0)::int AS added,coalesce(sum(removed),0)::int AS removed,count(*) FILTER(WHERE outcome='imported')::int AS imported,count(*) FILTER(WHERE outcome='unchanged')::int AS unchanged FROM source_imports WHERE imported_at >= $1`,[run.startedAt]);Object.assign(run,rows[0]);}finally{await db.end();}
}catch{run.status='failed';run.error='تعذر إكمال المزامنة؛ راجع سجل التشغيل المحلي.';}
finally{run.finishedAt=new Date().toISOString();await save();await log?.close();await connection.query("SELECT pg_advisory_unlock(hashtext('nbn-source-sync-runner'))");connection.release();await guard.end();}
process.exitCode=run.status==='success'?0:1;
