import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { getCustomerByHandle } from '@/lib/customers';
import { canManageCustomers } from '@/lib/validation';
import { createSarReport, type SarReportType, type SarReasonCategory, type SarActionTaken } from '@/lib/goaml';
import { getLastScreening } from '@/lib/screening';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    if (!canManageCustomers(actor.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (!hasFeature(actor, 'goaml_filing')) {
      return NextResponse.json({ error: 'هذه الميزة غير متاحة ضمن باقتك الحالية' }, { status: 403 });
    }

    const { id } = await params;
    const customer = await getCustomerByHandle(actor.organizationId, id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      reportType,
      reasonCategory,
      narrative,
      actionTaken,
      suspiciousAmount,
      currency,
      propertyDetails,
      paymentMode,
      virtualAssetDetails,
      dnfbpSector
    } = body;

    if (!reportType || !reasonCategory || !narrative || !actionTaken) {
      return NextResponse.json({ error: 'يرجى استكمال كافة الحقول الإلزامية لتقرير goAML' }, { status: 400 });
    }

    const last = await getLastScreening(actor.organizationId, customer.id);
    const topMatch = last?.top_matches?.[0];
    const screeningSummary = topMatch
      ? `Top match: ${topMatch.name} (${topMatch.category}) - ${topMatch.percent}% similarity on ${topMatch.source}`
      : 'No automated screening flags';

    const report = await createSarReport(actor, {
      customerId: customer.id,
      reportType: reportType as SarReportType,
      reasonCategory: reasonCategory as SarReasonCategory,
      narrative: String(narrative).trim(),
      actionTaken: actionTaken as SarActionTaken,
      customerSnapshot: {
        name: customer.name,
        entity_type: customer.entity_type,
        country: customer.country,
        nationality: customer.nationality,
        identifier: customer.identifier,
        date_of_birth: customer.date_of_birth,
        industry: customer.industry,
        email: customer.email,
        notes: customer.notes,
      },
      screeningSummary,
      suspiciousAmount: suspiciousAmount ? Number(suspiciousAmount) : undefined,
      currency: currency || 'AED',
      propertyDetails,
      paymentMode,
      virtualAssetDetails,
      dnfbpSector,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error('Error creating SAR report:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
