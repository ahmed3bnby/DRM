import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import { pool } from './db';
import type { Actor } from './auth';

const execFileAsync = promisify(execFile);

import { FREQUENCY_DETAILS, type ScheduleFrequency, type ScheduleConfig } from './schedule-types';
export { FREQUENCY_DETAILS, type ScheduleFrequency, type ScheduleConfig };

const CONFIG_FILE = path.join(process.cwd(), '.local', 'schedule-config.json');
const PLIST_LABEL = 'com.nbn.sources-sync';
const AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = path.join(AGENTS_DIR, `${PLIST_LABEL}.plist`);


export function computeNextRun(config: { enabled: boolean; frequency: ScheduleFrequency; timeOfDay: string }, lastRunTime?: string | null): string | null {
  if (!config.enabled) return null;

  const now = new Date();
  const [hourStr, minStr] = (config.timeOfDay || '03:30').split(':');
  const targetHour = parseInt(hourStr || '3', 10);
  const targetMin = parseInt(minStr || '30', 10);

  if (config.frequency === 'daily') {
    const candidate = new Date(now);
    candidate.setHours(targetHour, targetMin, 0, 0);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.toISOString();
  }

  if (config.frequency === 'weekly') {
    const candidate = new Date(now);
    candidate.setHours(targetHour, targetMin, 0, 0);
    // 0 is Sunday
    const daysUntilSunday = (7 - candidate.getDay()) % 7;
    candidate.setDate(candidate.getDate() + (daysUntilSunday === 0 && candidate.getTime() <= now.getTime() ? 7 : daysUntilSunday));
    return candidate.toISOString();
  }

  // Interval-based (6h, 12h, 48h)
  const hours = FREQUENCY_DETAILS[config.frequency]?.hours || 24;
  const baseTime = lastRunTime ? new Date(lastRunTime).getTime() : now.getTime();
  let nextMs = baseTime + hours * 3600 * 1000;
  while (nextMs <= now.getTime()) {
    nextMs += hours * 3600 * 1000;
  }
  return new Date(nextMs).toISOString();
}

export async function getScheduleConfig(lastRunTime?: string | null): Promise<ScheduleConfig> {
  let config: ScheduleConfig = {
    enabled: true,
    frequency: 'daily',
    timeOfDay: '03:30',
    intervalHours: 24,
    lastSavedAt: new Date().toISOString(),
  };

  try {
    const content = await readFile(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(content);
    config = { ...config, ...parsed };
  } catch {
    // If not written yet, create default file
    try {
      await mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch {}
  }

  config.nextRunEstimated = computeNextRun(config, lastRunTime) || undefined;
  return config;
}

export async function saveScheduleConfig(
  newSettings: { enabled: boolean; frequency: ScheduleFrequency; timeOfDay?: string },
  actor: Pick<Actor, 'id' | 'organizationId' | 'displayName'>,
  lastRunTime?: string | null
): Promise<ScheduleConfig> {
  const hours = FREQUENCY_DETAILS[newSettings.frequency]?.hours || 24;
  const timeOfDay = newSettings.timeOfDay || '03:30';

  const config: ScheduleConfig = {
    enabled: newSettings.enabled,
    frequency: newSettings.frequency,
    timeOfDay,
    intervalHours: hours,
    lastSavedAt: new Date().toISOString(),
    updatedBy: actor.displayName,
  };

  await mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');

  // Apply to launchd if on macOS
  if (process.platform === 'darwin') {
    try {
      await mkdir(AGENTS_DIR, { recursive: true });
      const projectDir = process.cwd();
      const cronScript = path.join(projectDir, 'scripts', 'sync-cron.sh');
      const logPath = path.join(projectDir, '.local', 'launchd.log');

      if (config.enabled) {
        let triggerXml = '';
        if (config.frequency === 'daily') {
          const [h, m] = timeOfDay.split(':').map(n => parseInt(n, 10));
          triggerXml = `  <key>StartCalendarInterval</key>\n  <dict><key>Hour</key><integer>${h || 3}</integer><key>Minute</key><integer>${m || 30}</integer></dict>`;
        } else if (config.frequency === 'weekly') {
          const [h, m] = timeOfDay.split(':').map(n => parseInt(n, 10));
          triggerXml = `  <key>StartCalendarInterval</key>\n  <dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>${h || 3}</integer><key>Minute</key><integer>${m || 30}</integer></dict>`;
        } else {
          // Interval in seconds
          const intervalSec = hours * 3600;
          triggerXml = `  <key>StartInterval</key>\n  <integer>${intervalSec}</integer>`;
        }

        const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${cronScript}</string>
  </array>
  <key>WorkingDirectory</key><string>${projectDir}</string>
${triggerXml}
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${logPath}</string>
  <key>StandardErrorPath</key><string>${logPath}</string>
</dict>
</plist>
`;
        await writeFile(PLIST_PATH, plistXml, 'utf8');
        try { await execFileAsync('/bin/launchctl', ['unload', '-w', PLIST_PATH]); } catch {}
        await execFileAsync('/bin/launchctl', ['load', '-w', PLIST_PATH]);
      } else {
        // Unload and disable
        try { await execFileAsync('/bin/launchctl', ['unload', '-w', PLIST_PATH]); } catch {}
      }
    } catch (err) {
      console.warn('Could not update launchd service:', err);
    }
  }

  // Apply to crontab if on Linux (VPS / Ubuntu / Debian / CentOS)
  if (process.platform === 'linux') {
    try {
      const projectDir = process.cwd();
      const cronScript = path.join(projectDir, 'scripts', 'sync-cron.sh');
      const CRON_TAG = '# DRM_SOURCES_SYNC';

      let currentCrontab = '';
      try {
        const { stdout } = await execFileAsync('crontab', ['-l']);
        currentCrontab = stdout;
      } catch {
        // No crontab yet for current user
      }

      // Filter out existing DRM cron lines
      const cleanLines = currentCrontab
        .split('\n')
        .filter(line => !line.includes('DRM_SOURCES_SYNC') && !line.includes('sync-cron.sh'));

      if (config.enabled) {
        let cronTiming = '30 3 * * *'; // default daily at 03:30
        const [h, m] = (timeOfDay || '03:30').split(':').map(n => parseInt(n, 10));

        if (config.frequency === 'every_6h') {
          cronTiming = `${m || 0} */6 * * *`;
        } else if (config.frequency === 'every_12h') {
          cronTiming = `${m || 0} */12 * * *`;
        } else if (config.frequency === 'daily') {
          cronTiming = `${m || 30} ${h || 3} * * *`;
        } else if (config.frequency === 'every_48h') {
          cronTiming = `${m || 30} ${h || 3} */2 * *`;
        } else if (config.frequency === 'weekly') {
          cronTiming = `${m || 30} ${h || 3} * * 0`;
        }

        const newCronLine = `${cronTiming} /bin/bash "${cronScript}" >/dev/null 2>&1 ${CRON_TAG}`;
        cleanLines.push(newCronLine);
      }

      const finalCron = cleanLines.filter(Boolean).join('\n') + '\n';
      const proc = spawn('crontab', ['-']);
      proc.stdin.write(finalCron);
      proc.stdin.end();
      await new Promise((resolve) => proc.on('close', resolve));
    } catch (err) {
      console.warn('Could not update linux crontab:', err);
    }
  }

  // Audit event
  try {
    await pool.query(
      `INSERT INTO audit_events(organization_id, actor_id, action, summary) VALUES ($1, $2, $3, $4)`,
      [
        actor.organizationId,
        actor.id,
        'schedule.configured',
        `تحديث جدول المزامنة التلقائية: ${config.enabled ? 'مفعل' : 'معطل'} · ${FREQUENCY_DETAILS[config.frequency]?.labelAr || config.frequency}`
      ]
    );
  } catch {}

  config.nextRunEstimated = computeNextRun(config, lastRunTime) || undefined;
  return config;
}
