'use server';

import { spawn } from 'node:child_process';
import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/auth';
import { isPlatformOwner } from '@/lib/platform-access';
import { syncRuns } from '@/lib/operations';
import { saveScheduleConfig, type ScheduleFrequency } from '@/lib/schedule-config';

export async function startSync() {
  const actor = await requireActor();
  if (actor.role !== 'admin') throw Error('FORBIDDEN');
  if (process.env.APP_ENV !== 'local') {
    return { ok: false, error: 'serverless' };
  }

  const runs = await syncRuns();
  if (runs.some(r => r.status === 'running')) {
    return { ok: false, error: 'busy' };
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/sync-runner.mjs'],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, SYNC_ACTOR_ID: actor.id }
      }
    );
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });

  revalidatePath('/admin');
  revalidatePath('/sources');
  return { ok: true, status: 'requested' };
}

export async function saveScheduleAction(formData: FormData) {
  const actor = await requireActor();
  if (!isPlatformOwner(actor)) throw Error('FORBIDDEN');

  const enabled = formData.get('enabled') === 'true' || formData.get('enabled') === 'on' || formData.get('enabled') === '1';
  const frequency = (String(formData.get('frequency') || 'daily')) as ScheduleFrequency;
  const timeOfDay = String(formData.get('timeOfDay') || '03:30');

  const config = await saveScheduleConfig({ enabled, frequency, timeOfDay }, actor);
  revalidatePath('/admin');
  return { ok: true, config };
}
