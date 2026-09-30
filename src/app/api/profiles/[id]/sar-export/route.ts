import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth';
import { getCustomerByHandle } from '@/lib/customers';
import { getSarReportById, generateGoAmlXml, generateGoAmlJson } from '@/lib/goaml';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const url = new URL(req.url);
    const reportId = url.searchParams.get('reportId');
    const format = url.searchParams.get('format') || 'xml';

    if (!reportId) {
      return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });
    }

    const customer = await getCustomerByHandle(actor.organizationId, id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const report = await getSarReportById(actor.organizationId, reportId);
    if (!report || report.customer_id !== customer.id) {
      return NextResponse.json({ error: 'SAR Report not found' }, { status: 404 });
    }

    const orgDetails = {
      name: actor.organizationName || 'Financial Institution',
      orgId: actor.organizationId,
    };

    if (format === 'json') {
      const jsonData = generateGoAmlJson(report, orgDetails);
      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="goAML_${report.reference_number}.json"`,
        },
      });
    }

    // Default: XML
    const xmlData = generateGoAmlXml(report, orgDetails);
    return new NextResponse(xmlData, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="goAML_${report.reference_number}.xml"`,
      },
    });
  } catch (err: any) {
    console.error('Error generating SAR export:', err);
    return NextResponse.json({ error: err.message || 'Export error' }, { status: 500 });
  }
}
