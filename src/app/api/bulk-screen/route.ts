import { NextRequest, NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { parseBulkFile, runBulkScreening, generateTemplateWorkbook, exportResultsToExcel } from '@/lib/bulk-screening';

export const dynamic = 'force-dynamic';

// Upload guardrails: cap file size and restrict to spreadsheet/CSV types so a
// malformed or oversized upload is rejected before it reaches the xlsx parser.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB — ample for the 500-row cap
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'application/csv',
  'text/plain', // some browsers send this for .csv
  'application/octet-stream', // some browsers omit a specific type
  '', // browsers that send no type at all
]);

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
          'Content-Disposition': 'attachment; filename="ABC_Screening_Template.xlsx"'
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

    // Gate the feature at the API boundary too — not just in the page — so the
    // endpoint can't be called directly by an org without the bulk plan.
    if (!hasFeature(actor, 'bulk_screening')) {
      return NextResponse.json({ error: 'هذه الميزة غير متاحة ضمن باقتك الحالية' }, { status: 403 });
    }

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
            'Content-Disposition': `attachment; filename="ABC_Bulk_Screening_Report_${new Date().toISOString().split('T')[0]}.xlsx"`
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

    // Reject empty or oversized files before buffering/parsing.
    if (file.size === 0) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' }, { status: 413 });
    }

    // Validate type by extension and (when provided) MIME type.
    const fileName = (file.name || '').toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    const mimeOk = ALLOWED_MIME.has(file.type || '');
    if (!extOk || !mimeOk) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم. يُسمح بملفات Excel (.xlsx, .xls) أو CSV فقط' }, { status: 415 });
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
