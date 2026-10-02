import { NextRequest, NextResponse } from 'next/server';
import { withPlatformOwner } from '@/lib/db';
import { executeMonitoringCycle } from '@/lib/ongoing-monitoring';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleMonitoringCron(req);
}

export async function POST(req: NextRequest) {
  return handleMonitoringCron(req);
}

async function handleMonitoringCron(req: NextRequest) {
  try {
    // 1. Authorization — fail CLOSED. The endpoint must never run unauthenticated,
    //    so a missing CRON_SECRET is a hard 500 (misconfiguration), not an open door.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET is not configured; refusing to run monitoring cron.');
      return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET not set' }, { status: 500 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch organizations that have monitored customers, WITH their plan/features.
    //    Runs as platform owner: customers is under FORCE RLS, so a plain pool query
    //    (no tenant context) would return zero rows in production and the cron would
    //    silently do nothing. organizations itself is not RLS-restricted.
    const orgsRes = await withPlatformOwner(db => db.query(`
      SELECT o.id, o.plan, o.features
      FROM organizations o
      WHERE EXISTS (
        SELECT 1 FROM customers c
        WHERE c.organization_id = o.id AND c.monitoring_enabled = true
      )
    `));

    const orgs = orgsRes.rows as { id: string; plan: string | null; features: Record<string, boolean> | null }[];
    let totalScanned = 0;
    let totalNewAlerts = 0;
    let totalFlagged = 0;
    let totalClear = 0;

    for (const org of orgs) {
      try {
        // Screen each org against ITS OWN plan/features, not a blanket admin that would
        // bypass plan gating (see isSourceAllowed). role 'admin' only grants permission
        // to run — it no longer unlocks premium sources.
        const cycleResult = await executeMonitoringCycle({
          organizationId: org.id,
          id: 'system-cron',
          role: 'admin',
          features: org.features || {},
          plan: org.plan || undefined,
        });

        totalScanned += cycleResult.scannedCount;
        totalNewAlerts += cycleResult.newAlertsCount;
        totalFlagged += cycleResult.flaggedCount;
        totalClear += cycleResult.clearCount;
      } catch (err) {
        console.error(`Cron monitoring cycle failed for org ${org.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      organizationsProcessed: orgs.length,
      metrics: {
        totalScanned,
        totalNewAlerts,
        totalFlagged,
        totalClear
      }
    });
  } catch (error) {
    console.error('Fatal cron monitoring error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
