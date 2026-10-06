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
          text: `🚨 [ABC Compliance Alert] New watchlist hit detected for ${payload.customerName} (${payload.customerReference})`,
          severity: payload.severity,
          // Send the risk category (classification), never the underlying data-source/provider
          // name — in line with the product rule of not exposing source identities.
          category: payload.details.category,
          similarity: payload.details.similarity != null ? `${payload.details.similarity}%` : undefined,
          timestamp: new Date().toISOString()
        })
      });
      return { dispatched: response.ok, channel: 'webhook' };
    } catch (err) {
      console.error('Failed to dispatch compliance webhook alert:', err);
    }
  }

  // 2. No channel configured: log for auditing and report honestly that nothing was
  // actually delivered (the in-app alert row is still created by the caller).
  console.log(`[Compliance Alert System] No webhook configured; alert logged for ${payload.customerName} [${payload.severity.toUpperCase()}]:`, payload.details);
  return { dispatched: false, channel: 'none' };
}
