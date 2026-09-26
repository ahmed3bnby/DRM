import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pool} from './db';
import {sourceSyncStatus} from './sources';
import { getScheduleConfig, type ScheduleConfig } from './schedule-config';

export type SyncRun = {
  id: string;
  pid: number;
  trigger: string;
  actorId: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  added: number;
  removed: number;
  imported: number;
  unchanged: number;
  exitCode?: number;
  error?: string;
};

export async function syncRuns(): Promise<SyncRun[]> {
  let rows: SyncRun[] = [];
  try {
    rows = JSON.parse(await readFile('.local/sync-runs.json', 'utf8'));
  } catch {
    return [];
  }
  return rows.map(r => {
    if (r.status !== 'running') return r;
    try {
      process.kill(r.pid, 0);
      return r;
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === 'ESRCH' ? { ...r, status: 'interrupted' } : r;
    }
  });
}

export async function schedulerStatus() {
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await promisify(execFile)('/bin/launchctl', ['print', `gui/${process.getuid?.()}/com.nbn.sources-sync`], { timeout: 3000, maxBuffer: 64000 });
      const exit = stdout.match(/last exit code = (\d+)/)?.[1];
      return { state: 'loaded' as const, exitCode: exit, running: /state = running/.test(stdout) };
    } catch (e) {
      return { state: (e as { stderr?: string }).stderr?.includes('Could not find service') ? 'not_loaded' as const : 'unknown' as const };
    }
  }

  if (process.platform === 'linux') {
    try {
      const { stdout } = await promisify(execFile)('crontab', ['-l'], { timeout: 3000 });
      const hasJob = stdout.includes('DRM_SOURCES_SYNC') || stdout.includes('sync-cron.sh');
      return { state: hasJob ? ('loaded' as const) : ('not_loaded' as const), running: false };
    } catch {
      return { state: 'not_loaded' as const };
    }
  }

  return { state: 'unsupported' as const };
}

export async function operationsData() {
  const start = Date.now();
  const [counts, sources, runs, scheduler, status] = await Promise.all([
    pool.query('SELECT count(*)::int AS lists,coalesce(sum(record_count),0)::bigint AS records FROM source_versions WHERE active'),
    pool.query(`SELECT v.code,v.record_count,v.retrieved_at,i.imported_at,i.added,i.removed,i.outcome FROM source_versions v LEFT JOIN LATERAL (SELECT * FROM source_imports WHERE code=v.code ORDER BY imported_at DESC LIMIT 1) i ON true WHERE v.active ORDER BY v.code`),
    syncRuns(),
    schedulerStatus(),
    sourceSyncStatus()
  ]);

  const latestScheduled = runs.find(r => r.trigger === 'scheduled') || null;
  const latestManual = runs.find(r => r.trigger === 'manual') || null;
  const scheduleConfig = await getScheduleConfig(latestScheduled?.startedAt || runs[0]?.startedAt);

  return {
    counts: counts.rows[0],
    sources: sources.rows.map(s => ({ ...s, syncStatus: status[s.code] })),
    runs,
    latestManual,
    latestScheduled,
    scheduleConfig,
    scheduler,
    checkedAt: new Date().toISOString(),
    latency: Date.now() - start
  };
}
