import { NextRequest, NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth';
import { parseBulkFile, runBulkScreening, generateTemplateWorkbook, exportResultsToExcel } from '@/lib/bulk-screening';

export const dynamic = 'force-dynamic';

// GET: Download sample Excel template
export async function GET(req: NextRequest) {
  try {
    await requireActor();
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'template') {
      const buffer = generateTemplateWorkbook();
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="DRM_Screening_Template.xlsx"'
        }
      });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'unauthorized' }, { status: 401 });
  }
}

// POST: Upload file and execute bulk screening, or export results
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor();
    const contentType = req.headers.get('content-type') || '';

    // Exporting JSON results to Excel
    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (body.action === 'export' && Array.isArray(body.results)) {
        const buffer = exportResultsToExcel(body.results);
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="DRM_Bulk_Screening_Report_${new Date().toISOString().split('T')[0]}.xlsx"`
          }
        });
      }
    }

    // Processing uploaded file
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'يرجى اختيار ملف Excel أو CSV لرفعه' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse rows
    const items = parseBulkFile(buffer);
    const autoEnroll = formData.get('autoEnroll') === '1';

    // Run batch screening
    const screeningResult = await runBulkScreening(actor, items, {
      autoEnrollMonitoring: autoEnroll
    });

    return NextResponse.json(screeningResult);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء فحص الملف' }, { status: 400 });
  }
}
