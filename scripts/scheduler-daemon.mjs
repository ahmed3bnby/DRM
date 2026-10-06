// Optional Standalone In-Process Background Scheduler Daemon for VPS (PM2 / Docker)
// Useful on Linux VPS environments where users prefer running a PM2 service instead of system crontab.
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

for(const p of ['.env.production.local', '.env.local', '.env']){if(existsSync(p)){try{process.loadEnvFile(p);}catch{}if(process.env.DATABASE_ADMIN_URL)break;}}

const CONFIG_FILE = path.join(process.cwd(), '.local', 'schedule-config.json');
let isRunning = false;

async function checkAndTrigger() {
  if (isRunning) return;

  try {
    const raw = await readFile(CONFIG_FILE, 'utf8');
    const config = JSON.parse(raw);

    if (!config || !config.enabled) return;

    const now = Date.now();
    const nextRun = config.nextRunEstimated ? new Date(config.nextRunEstimated).getTime() : 0;

    // If time to run
    if (nextRun > 0 && now >= nextRun) {
      console.log(`[${new Date().toISOString()}] Next run reached (${config.nextRunEstimated}). Triggering sync runner...`);
      isRunning = true;

      const child = spawn(process.execPath, ['scripts/sync-runner.mjs', '--scheduled'], {
        stdio: 'inherit',
        env: { ...process.env }
      });

      child.on('close', async (code) => {
        isRunning = false;
        console.log(`[${new Date().toISOString()}] Sync finished with exit code ${code}`);
      });
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[${new Date().toISOString()}] Scheduler daemon check error:`, err);
    }
  }
}

console.log(`[${new Date().toISOString()}] Compliance scheduler daemon started. Checking every 60 seconds...`);
setInterval(checkAndTrigger, 60000);
checkAndTrigger();
