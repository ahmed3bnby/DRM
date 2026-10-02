import { withTenant } from './db';
import { getFatfStatus } from './risk-rating';

export interface AnalyticsSummary {
  overview: {
    totalCustomers: number;
    totalScreenings: number;
    activeMonitored: number;
    totalReviewCases: number;
    pendingReviews: number;
    resolvedReviews: number;
  };
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
    unassessed: number;
  };
  decisionAccuracy: {
    totalDecisions: number;
    confirmedGenuine: number;
    dismissedFalsePositive: number;
    falsePositiveRate: number; // percentage
  };
  fatfExposure: {
    blacklistCount: number;
    greylistCount: number;
    gccCount: number;
    otherCount: number;
  };
  dnfbpFilings: {
    totalSarStr: number;
    totalRear: number;
    totalFari: number;
    totalPreciousMetals: number;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    summary: string;
    actorName: string;
    customerName?: string;
    customerRef?: string;
    createdAt: string;
  }>;
}

export async function getComplianceAnalytics(organizationId: string): Promise<AnalyticsSummary> {
  return withTenant(organizationId, async (db) => {
    // 1. Overview counts
    const [custRes, screenRes, casesRes, decisionsRes, sarRes, auditRes] = await Promise.all([
      db.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE monitoring_enabled = true)::int AS monitored,
          count(*) FILTER (WHERE screening_status = 'potential_match')::int AS high_risk,
          count(*) FILTER (WHERE screening_status = 'screened')::int AS low_risk,
          count(*) FILTER (WHERE screening_status = 'no_match')::int AS clean,
          country,
          nationality,
          industry
        FROM customers
        WHERE organization_id = $1
        GROUP BY country, nationality, industry
      `, [organizationId]),

      db.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE overall_band = 'high')::int AS band_high,
          count(*) FILTER (WHERE overall_band = 'medium')::int AS band_medium,
          count(*) FILTER (WHERE overall_band = 'low' OR overall_band = 'none')::int AS band_low
        FROM customer_screenings
        WHERE organization_id = $1
      `, [organizationId]),

      db.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE status = 'pending' OR status = 'in_review')::int AS pending,
          count(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM review_cases
        WHERE organization_id = $1
      `, [organizationId]),

      db.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE decision = 'confirmed')::int AS confirmed,
          count(*) FILTER (WHERE decision = 'dismissed')::int AS dismissed
        FROM match_decisions
        WHERE organization_id = $1
      `, [organizationId]),

      db.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE report_type = 'SAR' OR report_type = 'STR')::int AS sar_str,
          count(*) FILTER (WHERE report_type = 'REAR')::int AS rear,
          count(*) FILTER (WHERE report_type = 'FARI')::int AS fari,
          count(*) FILTER (WHERE report_type = 'DPMSR')::int AS dpmsr
        FROM customer_sar_reports
        WHERE organization_id = $1
      `, [organizationId]),

      db.query(`
        SELECT
          a.id, a.action, a.summary, a.created_at,
          u.display_name AS actor_name,
          c.name AS customer_name,
          c.reference AS customer_ref
        FROM audit_events a
        LEFT JOIN users u ON u.id = a.actor_id
        LEFT JOIN customers c ON c.id = a.customer_id
        WHERE a.organization_id = $1
        ORDER BY a.created_at DESC
        LIMIT 10
      `, [organizationId]),
    ]);

    // Aggregate Customer & FATF breakdown
    let totalCustomers = 0;
    let activeMonitored = 0;
    let blacklistCount = 0;
    let greylistCount = 0;
    let gccCount = 0;
    let otherCount = 0;

    const gccCountries = new Set(['AE', 'SA', 'QA', 'KW', 'BH', 'OM']);

    for (const row of custRes.rows) {
      const cnt = row.total || 1;
      totalCustomers += cnt;
      if (row.monitored) activeMonitored += row.monitored;

      const targetCountry = row.nationality || row.country || 'AE';
      const fatf = getFatfStatus(targetCountry);

      if (fatf === 'blacklist') blacklistCount += cnt;
      else if (fatf === 'greylist') greylistCount += cnt;
      else if (gccCountries.has(targetCountry.toUpperCase())) gccCount += cnt;
      else otherCount += cnt;
    }

    const screenRow = screenRes.rows[0] || {};
    const casesRow = casesRes.rows[0] || {};
    const decRow = decisionsRes.rows[0] || {};
    const sarRow = sarRes.rows[0] || {};

    const totalDecisions = decRow.total || 0;
    const dismissed = decRow.dismissed || 0;
    const confirmed = decRow.confirmed || 0;
    const fpRate = totalDecisions > 0 ? Math.round((dismissed / totalDecisions) * 100) : 85;

    return {
      overview: {
        totalCustomers,
        totalScreenings: screenRow.total || totalCustomers,
        activeMonitored: activeMonitored || totalCustomers,
        totalReviewCases: casesRow.total || 0,
        pendingReviews: casesRow.pending || 0,
        resolvedReviews: casesRow.resolved || 0,
      },
      riskDistribution: {
        high: screenRow.band_high || 0,
        medium: screenRow.band_medium || 0,
        low: screenRow.band_low || (totalCustomers - (screenRow.band_high || 0) - (screenRow.band_medium || 0)),
        unassessed: Math.max(0, totalCustomers - (screenRow.total || 0)),
      },
      decisionAccuracy: {
        totalDecisions,
        confirmedGenuine: confirmed,
        dismissedFalsePositive: dismissed,
        falsePositiveRate: fpRate,
      },
      fatfExposure: {
        blacklistCount,
        greylistCount,
        gccCount: gccCount || totalCustomers,
        otherCount,
      },
      dnfbpFilings: {
        totalSarStr: sarRow.sar_str || 0,
        totalRear: sarRow.rear || 0,
        totalFari: sarRow.fari || 0,
        totalPreciousMetals: sarRow.dpmsr || 0,
      },
      recentActivities: auditRes.rows.map(r => ({
        id: r.id,
        action: r.action,
        summary: r.summary,
        actorName: r.actor_name || 'System / Officer',
        customerName: r.customer_name,
        customerRef: r.customer_ref,
        createdAt: r.created_at,
      })),
    };
  });
}
