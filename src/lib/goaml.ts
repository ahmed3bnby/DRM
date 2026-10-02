import { withTenant } from './db';
import type { Customer } from './customers';
import type { Actor } from './auth';

export * from './goaml-types';
import type {
  SarReportType,
  SarReasonCategory,
  SarActionTaken,
  SarReportRecord,
} from './goaml-types';
import { SAR_REASON_LABELS, SAR_ACTION_LABELS } from './goaml-types';

export async function createSarReport(
  actor: Pick<Actor, 'id' | 'organizationId' | 'displayName' | 'role'>,
  params: {
    customerId: string;
    reportType: SarReportType;
    reasonCategory: SarReasonCategory;
    narrative: string;
    actionTaken: SarActionTaken;
    customerSnapshot: Partial<Customer>;
    screeningSummary?: string;
    suspiciousAmount?: number;
    currency?: string;
    propertyDetails?: {
      titleDeedNumber?: string;
      propertyType?: 'residential' | 'commercial' | 'industrial' | 'land';
      emirate?: string;
      projectOrBuilding?: string;
      developerOrSeller?: string;
    };
    paymentMode?: 'cash' | 'crypto_virtual_asset' | 'bank_transfer' | 'cheque' | 'mixed';
    virtualAssetDetails?: {
      cryptoType?: string;
      walletAddress?: string;
      txHash?: string;
    };
    dnfbpSector?: string;
  }
): Promise<SarReportRecord> {
  return withTenant(actor.organizationId, async db => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = params.reportType || 'SAR';
    const referenceNumber = `${prefix}-${today}-${rand}`;

    const fiuPayload = {
      customerSnapshot: params.customerSnapshot,
      officerName: actor.displayName,
      officerRole: actor.role === 'admin' ? 'Compliance Administrator / MLRO' : 'Compliance Analyst',
      screeningSummary: params.screeningSummary || '',
      suspiciousAmount: params.suspiciousAmount,
      currency: params.currency || 'AED',
      submissionDate: new Date().toISOString(),
      propertyDetails: params.propertyDetails,
      paymentMode: params.paymentMode,
      virtualAssetDetails: params.virtualAssetDetails,
      dnfbpSector: params.dnfbpSector,
    };

    const res = await db.query(
      `INSERT INTO customer_sar_reports (
        organization_id, customer_id, reference_number, report_type,
        reason_category, narrative, action_taken, created_by,
        created_at, status, fiu_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), 'submitted', $9)
      RETURNING *`,
      [
        actor.organizationId,
        params.customerId,
        referenceNumber,
        params.reportType,
        params.reasonCategory,
        params.narrative,
        params.actionTaken,
        actor.id,
        JSON.stringify(fiuPayload),
      ]
    );

    // Also write an audit event
    await db.query(
      `INSERT INTO audit_events(organization_id, actor_id, customer_id, action, summary)
       VALUES ($1, $2, $3, 'customer.sar_filed', $4)`,
      [
        actor.organizationId,
        actor.id,
        params.customerId,
        `تم إصدار وتوثيق تقرير اشتباه رسمي (${params.reportType}) برقم مرجعي: ${referenceNumber}`,
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      organization_id: row.organization_id,
      customer_id: row.customer_id,
      reference_number: row.reference_number,
      report_type: row.report_type,
      reason_category: row.reason_category,
      narrative: row.narrative,
      action_taken: row.action_taken,
      created_by: row.created_by,
      creator_name: actor.displayName,
      created_at: row.created_at,
      status: row.status,
      fiu_payload: row.fiu_payload,
    };
  });
}

export async function listSarReportsForCustomer(
  organizationId: string,
  customerId: string
): Promise<SarReportRecord[]> {
  return withTenant(organizationId, async db => {
    const res = await db.query(
      `SELECT r.*, u.display_name AS creator_name
       FROM customer_sar_reports r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.organization_id = $1 AND r.customer_id = $2
       ORDER BY r.created_at DESC`,
      [organizationId, customerId]
    );

    return res.rows.map(row => ({
      id: row.id,
      organization_id: row.organization_id,
      customer_id: row.customer_id,
      reference_number: row.reference_number,
      report_type: row.report_type,
      reason_category: row.reason_category,
      narrative: row.narrative,
      action_taken: row.action_taken,
      created_by: row.created_by,
      creator_name: row.creator_name || 'Compliance Officer',
      created_at: row.created_at,
      status: row.status,
      fiu_payload: row.fiu_payload || {},
    }));
  });
}

export async function getSarReportById(
  organizationId: string,
  reportId: string
): Promise<SarReportRecord | null> {
  return withTenant(organizationId, async db => {
    const res = await db.query(
      `SELECT r.*, u.display_name AS creator_name
       FROM customer_sar_reports r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.organization_id = $1 AND (r.id::text = $2 OR r.reference_number = $2)
       LIMIT 1`,
      [organizationId, reportId]
    );

    if (!res.rows.length) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      organization_id: row.organization_id,
      customer_id: row.customer_id,
      reference_number: row.reference_number,
      report_type: row.report_type,
      reason_category: row.reason_category,
      narrative: row.narrative,
      action_taken: row.action_taken,
      created_by: row.created_by,
      creator_name: row.creator_name || 'Compliance Officer',
      created_at: row.created_at,
      status: row.status,
      fiu_payload: row.fiu_payload || {},
    };
  });
}

/**
 * Generate a UAE FIU goAML XML document following the UNODC goAML structure.
 *
 * NOTE (pre-submission): dates are emitted as xs:dateTime and all values are XML-escaped,
 * but `<report_code>` and `<indicator>` carry the app's own report type / reason category.
 * Before real FIU submission these MUST be mapped to the official goAML UAE code tables
 * (report codes and indicator codes) and the output validated against the production
 * goAML.xsd — those code lists are issued by the FIU and are not bundled here.
 */
export function generateGoAmlXml(
  report: SarReportRecord,
  orgDetails: { name: string; orgId: string }
): string {
  const c = report.fiu_payload?.customerSnapshot || {};
  const isCompany = c.entity_type === 'company';
  const cleanStr = (val?: string | null) =>
    (val || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // goAML dates are xs:dateTime (YYYY-MM-DDThh:mm:ss). Only emit a birth date when we
  // have a full, valid calendar date — a bare year or malformed value is dropped rather
  // than written as an invalid element.
  const toGoAmlDateTime = (val?: string | null): string | null => {
    if (!val) return null;
    const m = String(val).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (isNaN(d.getTime())) return null;
    return `${m[1]}-${m[2]}-${m[3]}T00:00:00`;
  };
  const birthDateTime = toGoAmlDateTime(c.date_of_birth);

  const submissionDate = new Date(report.created_at).toISOString().replace(/\.\d{3}Z$/, '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<report xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="goAML.xsd">
  <rentity_id>${cleanStr(orgDetails.orgId.slice(0, 8).toUpperCase())}</rentity_id>
  <rentity_branch>MAIN</rentity_branch>
  <submission_code>E</submission_code>
  <report_code>${cleanStr(report.report_type)}</report_code>
  <entity_reference>${cleanStr(report.reference_number)}</entity_reference>
  <fiu_ref_number></fiu_ref_number>
  <submission_date>${submissionDate}</submission_date>
  <currency_code_local>AED</currency_code_local>
  <reporting_person>
    <first_name>${cleanStr(report.creator_name || 'Compliance')}</first_name>
    <last_name>Officer</last_name>
    <title>${cleanStr(report.fiu_payload?.officerRole || 'MLRO')}</title>
    <employer_name>${cleanStr(orgDetails.name)}</employer_name>
  </reporting_person>
  <location>
    <address_type>Commercial</address_type>
    <country_code_id>${cleanStr(c.country || 'AE')}</country_code_id>
  </location>
  <activity>
    <report_indicators>
      <indicator>${cleanStr(report.reason_category)}</indicator>
    </report_indicators>
    <reason>${cleanStr(report.narrative)}</reason>
    <action_taken>${cleanStr(report.action_taken)}</action_taken>
    ${
      report.fiu_payload?.suspiciousAmount
        ? `<amount_local currency="AED">${report.fiu_payload.suspiciousAmount}</amount_local>`
        : ''
    }
    ${
      report.fiu_payload?.paymentMode
        ? `<payment_mode>${cleanStr(report.fiu_payload.paymentMode)}</payment_mode>`
        : ''
    }
    ${
      report.fiu_payload?.propertyDetails?.titleDeedNumber
        ? `<property_transaction>
      <title_deed>${cleanStr(report.fiu_payload.propertyDetails.titleDeedNumber)}</title_deed>
      <property_type>${cleanStr(report.fiu_payload.propertyDetails.propertyType || 'residential')}</property_type>
      <emirate>${cleanStr(report.fiu_payload.propertyDetails.emirate || 'Dubai')}</emirate>
      <developer_seller>${cleanStr(report.fiu_payload.propertyDetails.developerOrSeller || '')}</developer_seller>
    </property_transaction>`
        : ''
    }
    ${
      report.fiu_payload?.virtualAssetDetails?.walletAddress
        ? `<virtual_asset_transfer>
      <crypto_type>${cleanStr(report.fiu_payload.virtualAssetDetails.cryptoType || 'USDT')}</crypto_type>
      <wallet_address>${cleanStr(report.fiu_payload.virtualAssetDetails.walletAddress)}</wallet_address>
      <tx_hash>${cleanStr(report.fiu_payload.virtualAssetDetails.txHash || '')}</tx_hash>
    </virtual_asset_transfer>`
        : ''
    }
  </activity>
  <parties>
    <party>
      <party_role>SUBJECT</party_role>
      ${
        isCompany
          ? `<t_entity>
        <name>${cleanStr(c.name)}</name>
        <incorporation_country_code>${cleanStr(c.country || 'AE')}</incorporation_country_code>
        <incorporation_number>${cleanStr(c.identifier || 'UNKNOWN')}</incorporation_number>
        <commercial_name>${cleanStr(c.name)}</commercial_name>
        <business>${cleanStr(c.industry || 'General')}</business>${
        c.email ? `
        <email>${cleanStr(c.email)}</email>` : ''
      }
      </t_entity>`
          : `<t_person>
        <first_name>${cleanStr(c.name?.split(' ')[0] || c.name)}</first_name>
        <last_name>${cleanStr(c.name?.split(' ').slice(1).join(' ') || '')}</last_name>${
        birthDateTime ? `
        <birth_date>${birthDateTime}</birth_date>` : ''
      }
        <nationality_country_code>${cleanStr(c.nationality || c.country || 'AE')}</nationality_country_code>
        <residence_country_code>${cleanStr(c.country || 'AE')}</residence_country_code>
        <id_number>${cleanStr(c.identifier || '')}</id_number>
        <occupation>${cleanStr(c.industry || 'Individual')}</occupation>
      </t_person>`
      }
    </party>
  </parties>
</report>`;
}

/**
 * Generate structured JSON payload for external systems & API integrations.
 */
export function generateGoAmlJson(
  report: SarReportRecord,
  orgDetails: { name: string; orgId: string }
): object {
  return {
    schemaVersion: 'goAML-UAE-2.0',
    reportReference: report.reference_number,
    reportType: report.report_type,
    submissionDate: report.created_at,
    reportingEntity: {
      id: orgDetails.orgId,
      name: orgDetails.name,
      officer: report.creator_name,
      role: report.fiu_payload?.officerRole,
    },
    subject: {
      id: report.customer_id,
      name: report.fiu_payload?.customerSnapshot?.name,
      entityType: report.fiu_payload?.customerSnapshot?.entity_type,
      country: report.fiu_payload?.customerSnapshot?.country,
      nationality: report.fiu_payload?.customerSnapshot?.nationality,
      identifier: report.fiu_payload?.customerSnapshot?.identifier,
      industry: report.fiu_payload?.customerSnapshot?.industry,
    },
    reasonCategory: report.reason_category,
    reasonLabel: SAR_REASON_LABELS[report.reason_category]?.ar,
    actionTaken: report.action_taken,
    actionLabel: SAR_ACTION_LABELS[report.action_taken]?.ar,
    narrative: report.narrative,
    screeningSummary: report.fiu_payload?.screeningSummary,
    suspiciousAmount: report.fiu_payload?.suspiciousAmount,
    currency: report.fiu_payload?.currency || 'AED',
  };
}
