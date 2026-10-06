import { NextRequest, NextResponse } from 'next/server';
import { runAllOrgsMonitoring } from '@/lib/ongoing-monitoring';

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

    // 2. Run a monitoring cycle for every org with monitored customers, each against its
    //    own plan/features (shared with the scheduled scripts/run-monitoring.ts runner).
    const result = await runAllOrgsMonitoring();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      organizationsProcessed: result.organizationsProcessed,
      metrics: {
        totalScanned: result.totalScanned,
        totalNewAlerts: result.totalNewAlerts,
        totalFlagged: result.totalFlagged,
        totalClear: result.totalClear
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
