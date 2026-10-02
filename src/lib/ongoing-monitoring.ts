import { withTenant, pool } from '@/lib/db';
import { screenCustomer } from '@/lib/screening';
import { hasFeature } from '@/lib/features';
import type { Actor } from '@/lib/auth';

export interface MonitoringAlert {
  id: string;
  organizationId: string;
  customerId: string;
  customerName?: string;
  customerReference?: string;
  eventType: 'new_watchlist_hit' | 'score_increased' | 'adverse_media_hit' | 'status_changed';
  severity: 'high' | 'medium' | 'low';
  title: string;
  details: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export async function toggleCustomerMonitoring(
  organizationId: string,
  customerId: string,
  enabled: boolean
): Promise<{ success: boolean; enabled: boolean }> {
  return withTenant(organizationId, async db => {
    const res = await db.query(
      `UPDATE customers
       SET monitoring_enabled = $3,
           updated_at = now()
       WHERE organization_id = $1 AND id = $2
       RETURNING monitoring_enabled`,
      [organizationId, customerId, enabled]
    );
    return { success: (res.rowCount ?? 0) > 0, enabled };
  });
}

export async function listMonitoringAlerts(
  organizationId: string,
  unreadOnly = false
): Promise<MonitoringAlert[]> {
  return withTenant(organizationId, async db => {
    const sql = `
      SELECT
        e.id,
        e.organization_id AS "organizationId",
        e.customer_id AS "customerId",
        c.name AS "customerName",
        c.reference AS "customerReference",
        e.event_type AS "eventType",
        e.severity,
        e.title,
        e.details,
        e.is_read AS "isRead",
        e.created_at AS "createdAt"
      FROM customer_monitoring_events e
      JOIN customers c ON c.id = e.customer_id
      WHERE e.organization_id = $1
        ${unreadOnly ? 'AND NOT e.is_read' : ''}
      ORDER BY e.created_at DESC
      LIMIT 100
    `;
    const res = await db.query(sql, [organizationId]);
    return res.rows;
  });
}

export async function markAlertAsRead(
  organizationId: string,
  alertId: string
): Promise<boolean> {
  return withTenant(organizationId, async db => {
    const res = await db.query(
      `UPDATE customer_monitoring_events
       SET is_read = true
       WHERE organization_id = $1 AND id = $2`,
      [organizationId, alertId]
    );
    return (res.rowCount ?? 0) > 0;
  });
}

export async function executeMonitoringCycle(
  actor: Pick<Actor, 'id' | 'organizationId' | 'role' | 'features'> & Partial<Pick<Actor, 'plan'>>
): Promise<{
  scannedCount: number;
  newAlertsCount: number;
  flaggedCount: number;
  clearCount: number;
}> {
  // Enforce the premium gate centrally: orgs without the ongoing_monitoring feature
  // (and non-enterprise plans) are not monitored — covers both the cron and the
  // manual trigger action, so the feature can't be used for free.
  if (!hasFeature(actor, 'ongoing_monitoring')) {
    return { scannedCount: 0, newAlertsCount: 0, flaggedCount: 0, clearCount: 0 };
  }
  return withTenant(actor.organizationId, async db => {
    // 1. Fetch monitored customers
    const custRes = await db.query(
      `SELECT id, name, reference, monitoring_status, last_monitored_at
       FROM customers
       WHERE organization_id = $1 AND monitoring_enabled = true
       ORDER BY last_monitored_at ASC NULLS FIRST
       LIMIT 50`,
      [actor.organizationId]
    );

    const customers = custRes.rows;
    let newAlertsCount = 0;
    let flaggedCount = 0;
    let clearCount = 0;

    for (const cust of customers) {
      try {
        // Run screening
        const { matches, overall } = await screenCustomer(actor, cust.id);

        // Previous matches check
        const prevRes = await db.query(
          `SELECT top_matches FROM customer_screenings
           WHERE organization_id = $1 AND customer_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [actor.organizationId, cust.id]
        );

        const prevMatches: any[] = prevRes.rows[0]?.top_matches || [];
        const prevRecordIds = new Set(prevMatches.map((m: any) => m.recordId || m.sourceRecordId));

        // Records we've already alerted on for this customer. The monitoring cycle
        // does not advance the customer_screenings baseline, so without this a still-
        // matching record would re-alert every cycle. Dedupe on the record ids stored
        // in previously-created alerts so each record alerts at most once.
        const alertedRes = await db.query(
          `SELECT DISTINCT jsonb_array_elements_text(COALESCE(details->'recordIds','[]'::jsonb)) AS rid
           FROM customer_monitoring_events
           WHERE organization_id = $1 AND customer_id = $2`,
          [actor.organizationId, cust.id]
        );
        const alertedIds = new Set<string>(alertedRes.rows.map((r: any) => r.rid));

        // Find genuinely new hits (not in the last saved screening, not already alerted).
        const relevantNewHits = matches.filter(
          m => m.c.percent >= 75
            && !prevRecordIds.has(m.r.id) && !prevRecordIds.has(m.r.source_record_id)
            && !alertedIds.has(m.r.id) && !alertedIds.has(m.r.source_record_id)
        );

        const hasHits = matches.some(m => m.c.percent >= 75);

        if (relevantNewHits.length > 0) {
          // Create monitoring alert event
          const topHit = relevantNewHits[0];
          const severity = topHit.c.band === 'high' ? 'high' : 'medium';
          const alertTitle = `تنبيه مراقبة: إدراج جديد أو تطابق مستجد (${topHit.r.code}) للعميل ${cust.name}`;

          await db.query(
            `INSERT INTO customer_monitoring_events
             (organization_id, customer_id, event_type, severity, title, details)
             VALUES ($1, $2, 'new_watchlist_hit', $3, $4, $5)`,
            [
              actor.organizationId,
              cust.id,
              severity,
              alertTitle,
              JSON.stringify({
                source: topHit.r.code,
                matchedName: topHit.r.name,
                similarity: topHit.c.percent,
                category: topHit.c.category,
                detectedAt: new Date().toISOString(),
                // All new record ids covered by this alert — used to dedupe future cycles.
                recordIds: relevantNewHits.flatMap(h => [h.r.id, h.r.source_record_id].filter(Boolean))
              })
            ]
          );

          await db.query(
            `UPDATE customers
             SET monitoring_status = 'flagged',
                 monitoring_hit_count = monitoring_hit_count + $3,
                 last_monitored_at = now()
             WHERE organization_id = $1 AND id = $2`,
            [actor.organizationId, cust.id, relevantNewHits.length]
          );

          newAlertsCount++;
          flaggedCount++;

          // Dispatch real-time compliance alert notification
          const { dispatchComplianceNotification } = await import('@/lib/notifications');
          dispatchComplianceNotification({
            organizationId: actor.organizationId,
            eventType: 'new_watchlist_hit',
            customerName: cust.name,
            customerReference: cust.reference,
            severity,
            details: {
              source: topHit.r.code,
              matchedName: topHit.r.name,
              similarity: topHit.c.percent,
              category: topHit.c.category
            }
          }).catch(e => console.error('Notification dispatch error:', e));
        } else {
          await db.query(
            `UPDATE customers
             SET monitoring_status = $3,
                 last_monitored_at = now()
             WHERE organization_id = $1 AND id = $2`,
            [actor.organizationId, cust.id, hasHits ? 'pending_review' : 'clear']
          );

          if (hasHits) flaggedCount++;
          else clearCount++;
        }
      } catch (err) {
        console.error(`Error monitoring customer ${cust.id}:`, err);
      }
    }

    return {
      scannedCount: customers.length,
      newAlertsCount,
      flaggedCount,
      clearCount
    };
  });
}
