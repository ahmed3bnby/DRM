import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
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
    // 1. Verify authorization if CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 2. Fetch all organizations with active monitored customers
    const orgsRes = await pool.query(`
      SELECT DISTINCT organization_id
      FROM customers
      WHERE monitoring_enabled = true
    `);

    const orgIds = orgsRes.rows.map(r => r.organization_id);
    let totalScanned = 0;
    let totalNewAlerts = 0;
    let totalFlagged = 0;
    let totalClear = 0;

    for (const orgId of orgIds) {
      try {
        const cycleResult = await executeMonitoringCycle({
          organizationId: orgId,
          id: 'system-cron',
          role: 'admin',
          features: { reviews: true, monitoring: true }
        });

        totalScanned += cycleResult.scannedCount;
        totalNewAlerts += cycleResult.newAlertsCount;
        totalFlagged += cycleResult.flaggedCount;
        totalClear += cycleResult.clearCount;
      } catch (err) {
        console.error(`Cron monitoring cycle failed for org ${orgId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      organizationsProcessed: orgIds.length,
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
