import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { currentActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { canManageCustomers } from '@/lib/validation';
import { analyzeDocumentText, OCR_DEMO_PRESETS } from '@/lib/ocr-parser';

// OCR runs a heavy Tesseract pass, so bound the input: cap size and accept only
// images / PDF, both for multipart uploads and base64 payloads.
const MAX_OCR_BYTES = 10 * 1024 * 1024; // 10 MB
// Tesseract reads raster images only — a PDF would fail deep inside the OCR engine.
const ALLOWED_OCR_MIME = /^image\/(png|jpe?g|webp|gif|bmp|tiff?)$/i;
const OCR_TIMEOUT_MS = 45_000;

// One worker per scan, always terminated, with a hard timeout so a stuck OCR pass returns a
// clear error instead of leaving the user on a spinner forever.
async function recognizeText(buffer: Buffer): Promise<string> {
  const Tesseract = (await import('tesseract.js')).default;
  // Language data ships with the app (ocr-data/eng.traineddata, bundled via next.config
  // outputFileTracingIncludes): no CDN download at runtime and no cache writes — serverless
  // filesystems are read-only outside /tmp.
  const worker = await Tesseract.createWorker('eng', 1, {
    langPath: path.join(process.cwd(), 'ocr-data'),
    gzip: false,
    cacheMethod: 'none',
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), OCR_TIMEOUT_MS);
    });
    const res = await Promise.race([worker.recognize(buffer), timeout]);
    return res.data.text;
  } finally {
    if (timer) clearTimeout(timer);
    await worker.terminate().catch(() => undefined);
  }
}

export const maxDuration = 60; // OCR on a cold serverless instance can take several seconds

export async function POST(req: NextRequest) {
  try {
    const actor = await currentActor();
    if (!actor) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً للمتابعة.' }, { status: 401 });
    }
    if (!canManageCustomers(actor.role)) {
      return NextResponse.json({ error: 'صلاحيتك تسمح بالاطلاع فقط.' }, { status: 403 });
    }
    if (!hasFeature(actor, 'document_ocr')) {
      return NextResponse.json({ error: 'هذه الميزة غير متاحة ضمن باقتك الحالية' }, { status: 403 });
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
        const parsed = analyzeDocumentText(await recognizeText(buffer));
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
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        return NextResponse.json({ error: 'ملفات PDF غير مدعومة حالياً — ارفع صورة للمستند (PNG أو JPG).' }, { status: 415 });
      }
      if (file.type && !ALLOWED_OCR_MIME.test(file.type)) {
        return NextResponse.json({ error: 'نوع الملف غير مدعوم. يُسمح بالصور فقط (PNG / JPG / WebP).' }, { status: 415 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = analyzeDocumentText(await recognizeText(buffer));
      return NextResponse.json({ success: true, data: parsed });
    }

    return NextResponse.json({ error: 'نوع الطلب غير مدعوم.' }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'OCR_TIMEOUT') {
      return NextResponse.json({ error: 'استغرق تحليل الصورة وقتاً أطول من المتوقع. جرّب صورة أوضح وأصغر حجماً.' }, { status: 504 });
    }
    console.error('OCR scan failed:', err);
    return NextResponse.json({ error: 'تعذّر قراءة المستند. جرّب صورة أوضح أو أدخل البيانات يدوياً.' }, { status: 500 });
  }
}
