/**
 * Scheduled ongoing-monitoring runner. Runs a monitoring cycle for every organization that
 * has monitored customers (each against its own plan/features), the same work as the
 * /api/cron/monitoring endpoint — but as a standalone process so it can be chained after the
 * source sync in sync-cron.sh, without needing the web server up or an HTTP call.
 *
 * Run:  node --import tsx scripts/run-monitoring.ts
 */
import { existsSync } from 'node:fs';

// Load env BEFORE importing anything that opens the DB pool (db.ts reads DATABASE_URL at import).
for (const p of ['.env.production.local', '.env.local', '.env']) {
  if (existsSync(p)) {
    try { process.loadEnvFile(p); } catch {}
    if (process.env.DATABASE_URL) break;
  }
}

const { runAllOrgsMonitoring } = await import('../src/lib/ongoing-monitoring');

try {
  const r = await runAllOrgsMonitoring();
  console.log(
    `monitoring: ${r.organizationsProcessed} org(s) | scanned ${r.totalScanned} | ` +
    `new alerts ${r.totalNewAlerts} | flagged ${r.totalFlagged} | clear ${r.totalClear}`
  );
  process.exit(0);
} catch (err) {
  console.error('monitoring run failed:', err);
  process.exit(1);
}
