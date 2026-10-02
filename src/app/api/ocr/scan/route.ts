import { NextRequest, NextResponse } from 'next/server';
import { currentActor } from '@/lib/auth';
import { canManageCustomers } from '@/lib/validation';
import { analyzeDocumentText, OCR_DEMO_PRESETS } from '@/lib/ocr-parser';

// OCR runs a heavy Tesseract pass, so bound the input: cap size and accept only
// images / PDF, both for multipart uploads and base64 payloads.
const MAX_OCR_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_OCR_MIME = /^(image\/(png|jpe?g|webp|gif|bmp|tiff?)|application\/pdf)$/i;

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
        if (buffer.length === 0) {
          return NextResponse.json({ error: 'الصورة فارغة أو غير صالحة.' }, { status: 400 });
        }
        if (buffer.length > MAX_OCR_BYTES) {
          return NextResponse.json({ error: 'حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت).' }, { status: 413 });
        }
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

      if (file.size === 0) {
        return NextResponse.json({ error: 'الملف فارغ.' }, { status: 400 });
      }
      if (file.size > MAX_OCR_BYTES) {
        return NextResponse.json({ error: 'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت).' }, { status: 413 });
      }
      if (file.type && !ALLOWED_OCR_MIME.test(file.type)) {
        return NextResponse.json({ error: 'نوع الملف غير مدعوم. يُسمح بالصور (PNG/JPG/WebP) أو PDF فقط.' }, { status: 415 });
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
