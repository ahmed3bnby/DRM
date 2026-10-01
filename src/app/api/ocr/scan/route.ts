import { NextRequest, NextResponse } from 'next/server';
import { currentActor } from '@/lib/auth';
import { canManageCustomers } from '@/lib/validation';
import { analyzeDocumentText, OCR_DEMO_PRESETS } from '@/lib/ocr-parser';

export async function POST(req: NextRequest) {
  try {
    const actor = await currentActor();
    if (!actor) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً للمتابعة.' }, { status: 401 });
    }
    if (!canManageCustomers(actor.role)) {
      return NextResponse.json({ error: 'صلاحيتك تسمح بالاطلاع فقط.' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';

    // 1. JSON Request (Demo Preset or Base64 / Text)
    if (contentType.includes('application/json')) {
      const body = await req.json();

      // Demo Preset Quick Handler
      if (body.preset && OCR_DEMO_PRESETS[body.preset]) {
        return NextResponse.json({
          success: true,
          data: OCR_DEMO_PRESETS[body.preset]
        });
      }

      if (body.text) {
        const parsed = analyzeDocumentText(body.text);
        return NextResponse.json({ success: true, data: parsed });
      }

      if (body.base64) {
        const buffer = Buffer.from(body.base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const Tesseract = (await import('tesseract.js')).default;
        const res = await Tesseract.recognize(buffer, 'eng', {
          logger: () => {}
        });
        const parsed = analyzeDocumentText(res.data.text);
        return NextResponse.json({ success: true, data: parsed });
      }
    }

    // 2. FormData Multipart Upload (Image or PDF)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const preset = formData.get('preset') as string | null;

      if (preset && OCR_DEMO_PRESETS[preset]) {
        return NextResponse.json({
          success: true,
          data: OCR_DEMO_PRESETS[preset]
        });
      }

      if (!file) {
        return NextResponse.json({ error: 'لم يتم إرفاق ملف للتحليل.' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const Tesseract = (await import('tesseract.js')).default;
      const res = await Tesseract.recognize(buffer, 'eng', {
        logger: () => {}
      });

      const parsed = analyzeDocumentText(res.data.text);
      return NextResponse.json({ success: true, data: parsed });
    }

    return NextResponse.json({ error: 'نوع الطلب غير مدعوم.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل المسح الضوئي للمستند.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
