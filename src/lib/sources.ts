import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db';
export type SourceProbe = {code:string;url:string;checkedAt:string;status:string;recordCount?:number;rowCount?:number;httpStatus?:number;sha256?:string;screeningReady:boolean;error?:string};
export async function sourceProbes(): Promise<SourceProbe[]> {
  try { const report=JSON.parse(await readFile(path.join(process.cwd(),'docs/evidence/source-access.json'),'utf8')); return report.sources; }
  catch { return []; }
}

export type CatalogSource = {code:string;title:string;type:string;country?:string;publisher?:string;official:boolean;license?:string;entityCount?:number;version?:string;lastChange?:string;lastExport?:string;csvUrl?:string};
type Catalog = {retrievedAt?:string;total:number;sources:CatalogSource[]};


// The public-source registry array, written by the OpenSanctions catalog step.
export async function sourceCatalog(): Promise<Catalog|null> {
  try { return JSON.parse(await readFile(path.join(process.cwd(),'.local/sources/_catalog.json'),'utf8')); } catch { return null; }
}
// The lists we actively track and import.
export async function watchlistCodes(): Promise<string[]> {
  try { return JSON.parse(await readFile(path.join(process.cwd(),'scripts/watchlist.json'),'utf8')).datasets as string[]; } catch { return []; }
}
// Upstream changes detected at the last catalog refresh (no downloads needed).
export async function sourceChanges(): Promise<{updatedLists:{code:string}[];newLists:string[];checkedAt?:string}|null> {
  try { return JSON.parse(await readFile(path.join(process.cwd(),'.local/sources/_changes.json'),'utf8')); } catch { return null; }
}
export type ImportRow = {imported_at:Date;added:number;removed:number;outcome:string;record_count:number;upstream_version:string|null};
// Most recent import per source code from the change log. Empty until the table exists.
export async function importHistory(): Promise<Record<string,ImportRow>> {
  try {
    const {rows}=await pool.query(`SELECT DISTINCT ON (code) code,imported_at,added,removed,outcome,record_count,upstream_version FROM source_imports ORDER BY code,imported_at DESC`);
    return Object.fromEntries(rows.map(r=>[r.code,r as ImportRow]));
  } catch { return {}; }
}

export async function sourceSyncStatus():Promise<Record<string,{status:'success'|'failed';checkedAt:string}>> {
 try{return JSON.parse(await readFile(path.join(process.cwd(),'.local/sources/_sync-status.json'),'utf8'));}catch{return {};}
}
