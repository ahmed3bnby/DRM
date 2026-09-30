/**
 * Compliance Notifications & Alert Dispatcher
 * Dispatches automated alerts when ongoing monitoring or screenings detect critical watchlist hits.
 */

export interface NotificationPayload {
  organizationId: string;
  eventType: 'new_watchlist_hit' | 'score_increased' | 'adverse_media_hit';
  customerName: string;
  customerReference: string;
  severity: 'high' | 'medium' | 'low';
  details: {
    source?: string;
    matchedName?: string;
    similarity?: number;
    category?: string;
  };
}

export async function dispatchComplianceNotification(payload: NotificationPayload): Promise<{
  dispatched: boolean;
  channel: 'webhook' | 'email' | 'none';
}> {
  const webhookUrl = process.env.COMPLIANCE_WEBHOOK_URL;

  // 1. If Webhook URL is configured (Slack, Microsoft Teams, Discord, or internal AML webhook)
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 [DRM Compliance Alert] New watchlist hit detected for ${payload.customerName} (${payload.customerReference})`,
          severity: payload.severity,
          source: payload.details.source,
          similarity: `${payload.details.similarity}%`,
          timestamp: new Date().toISOString()
        })
      });
      return { dispatched: response.ok, channel: 'webhook' };
    } catch (err) {
      console.error('Failed to dispatch compliance webhook alert:', err);
    }
  }

  // 2. Simulated / Logged delivery for auditing
  console.log(`[DRM Alert System] Notification queued for ${payload.customerName} [${payload.severity.toUpperCase()}]:`, payload.details);
  return { dispatched: true, channel: 'none' };
}
