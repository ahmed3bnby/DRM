'use client';

import { useState, useRef, useTransition } from 'react';
import {
  ScanLine,
  UploadCloud,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  RefreshCw,
  Building2,
  CreditCard,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import type { ExtractedDocData } from '@/lib/ocr-parser';
import { useLocale } from '@/components/locale-context';

interface IdOcrScannerProps {
  onExtracted: (data: ExtractedDocData) => void;
}

export default function IdOcrScanner({ onExtracted }: IdOcrScannerProps) {
  const { locale } = useLocale();
  const isEn = locale === 'en';

  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [progressStage, setProgressStage] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedDocData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const triggerScanAnimation = (callback: () => Promise<void>) => {
    setStatus('scanning');
    setErrorMsg(null);
    setProgressStage(isEn ? 'Reading document pixels & visual layout...' : 'قراءة المستند واستخراج النصوص البصرية...');

    const timer1 = setTimeout(() => {
      setProgressStage(isEn ? 'Analyzing Machine Readable Zone (MRZ) & Security Fields...' : 'تحليل منطقة القراءة الآلية (MRZ) والأرقام الرسمية...');
    }, 450);

    const timer2 = setTimeout(() => {
      setProgressStage(isEn ? 'Verifying identity numbers, expiry dates & nationality...' : 'التحقق من صحة أرقام الهوية وتواريخ الصلاحية والجنسية...');
    }, 900);

    startTransition(async () => {
      try {
        await callback();
        clearTimeout(timer1);
        clearTimeout(timer2);
      } catch (err: unknown) {
        clearTimeout(timer1);
        clearTimeout(timer2);
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : (isEn ? 'Failed to process document' : 'فشل تحليل المستند'));
      }
    });
  };

  // 1. Process 1-Click Demo Preset
  const handlePresetSelect = (presetKey: string) => {
    triggerScanAnimation(async () => {
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: presetKey })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to scan preset');

      // Slight natural delay for animation delight
      await new Promise(r => setTimeout(r, 950));

      setExtractedData(json.data);
      setStatus('success');
      onExtracted(json.data);
    });
  };

  // 2. Process Custom File Upload (Image or PDF)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create thumbnail preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }

    triggerScanAnimation(async () => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || (isEn ? 'OCR scan failed' : 'فشل المسح الضوئي للمستند'));

      await new Promise(r => setTimeout(r, 600));

      setExtractedData(json.data);
      setStatus('success');
      onExtracted(json.data);
    });
  };

  const handleReset = () => {
    setStatus('idle');
    setExtractedData(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const docIcon = (type: string) => {
    if (type === 'EMIRATES_ID') return <CreditCard size={18} className="text-emerald-500" />;
    if (type === 'TRADE_LICENSE') return <Building2 size={18} className="text-blue-500" />;
    return <FileText size={18} className="text-amber-500" />;
  };

  const docLabel = (type: string) => {
    if (type === 'EMIRATES_ID') return isEn ? 'Emirates ID (UAE)' : 'بطاقة الهوية الإماراتية';
    if (type === 'TRADE_LICENSE') return isEn ? 'UAE Commercial License' : 'رخصة تجارية إماراتية';
    if (type === 'PASSPORT') return isEn ? 'International Passport' : 'جواز سفر دولي';
    return isEn ? 'National ID / Document' : 'وثيقة إثبات شخصية';
  };

  return (
    <div className="ocr-scanner-card" dir={isEn ? 'ltr' : 'rtl'}>
      {/* Top Header */}
      <div className="ocr-scanner-head">
        <div className="ocr-head-badge">
          <Sparkles size={16} />
          <span>{isEn ? 'Smart Document OCR (MRZ)' : 'المسح الضوئي الذكي للمستندات (MRZ)'}</span>
        </div>
        <div className="ocr-head-title-row">
          <div>
            <h3 className="ocr-title">
              <ScanLine size={20} />
              <span>{isEn ? 'Instant KYC Document Auto-Fill' : 'المسح الضوئي التلقائي للهويات والمستندات'}</span>
            </h3>
            <p className="ocr-subtitle">
              {isEn
                ? 'Upload an Emirates ID, Passport, or Trade License to auto-fill customer details and run instant screening.'
                : 'ارفع بطاقة الهوية الإماراتية، أو جواز السفر، أو الرخصة التجارية لتعبئة بيانات العميل وتشغيل الفحص فوراً.'}
            </p>
          </div>
        </div>

        {/* 1-Click Instant Demo Presets Bar */}
        <div className="ocr-presets-bar">
          <span className="ocr-presets-label">
            {isEn ? 'Try instant demo preset:' : 'جرّب فوراً بنموذج تجريبي:'}
          </span>
          <div className="ocr-preset-buttons">
            <button
              type="button"
              className="ocr-preset-btn preset-eid"
              onClick={() => handlePresetSelect('emirates-id')}
              disabled={status === 'scanning'}
            >
              <span className="preset-flag">🇦🇪</span>
              <span>{isEn ? 'Emirates ID (Hamza Rizwan)' : 'هوية إماراتية (حمزة رضوان)'}</span>
            </button>
            <button
              type="button"
              className="ocr-preset-btn preset-pass"
              onClick={() => handlePresetSelect('passport')}
              disabled={status === 'scanning'}
            >
              <span className="preset-flag">🛂</span>
              <span>{isEn ? 'Passport (Anna Eriksson)' : 'جواز سفر (Anna Eriksson)'}</span>
            </button>
            <button
              type="button"
              className="ocr-preset-btn preset-trade"
              onClick={() => handlePresetSelect('trade-license')}
              disabled={status === 'scanning'}
            >
              <span className="preset-flag">🏢</span>
              <span>{isEn ? 'Trade License (Cube Realty)' : 'رخصة تجارية (Cube Realty)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      {status === 'idle' && (
        <div
          className="ocr-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
            const file = e.dataTransfer.files?.[0];
            if (file) {
              const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleFileChange(fakeEvent);
            }
          }}
        >
          <div className="ocr-dropzone-inner">
            <div className="ocr-icon-circle">
              <UploadCloud size={28} />
            </div>
            <div className="ocr-drop-text">
              <strong>{isEn ? 'Drag & drop ID image or click to browse' : 'اسحب صورة الهوية أو المستند هنا أو انقر للاختيار'}</strong>
              <small>{isEn ? 'Supports Emirates ID, Passports, Trade Licenses (JPG, PNG, WebP, PDF)' : 'يدعم الهوية الإماراتية وجوازات السفر والرخص التجارية (JPG, PNG, WebP, PDF)'}</small>
            </div>
            <div className="ocr-actions-row" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="ocr-action-button primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={16} />
                <span>{isEn ? 'Choose File' : 'اختيار ملف'}</span>
              </button>
              <button
                type="button"
                className="ocr-action-button camera"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={16} />
                <span>{isEn ? 'Camera' : 'التقاط بالكاميرا'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanning State with Laser Animation */}
      {status === 'scanning' && (
        <div className="ocr-scanning-zone">
          <div className="ocr-scanner-visual">
            <div className="ocr-laser-beam" />
            <div className="ocr-doc-mockup">
              <div className="doc-mock-photo" />
              <div className="doc-mock-lines">
                <span className="line line-1" />
                <span className="line line-2" />
                <span className="line line-3" />
                <span className="line line-4" />
              </div>
            </div>
          </div>
          <div className="ocr-progress-container">
            <div className="ocr-spinner-row">
              <RefreshCw size={18} className="animate-spin text-emerald-500" />
              <span className="ocr-progress-text">{progressStage}</span>
            </div>
            <div className="ocr-progress-bar">
              <div className="ocr-progress-fill" />
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {status === 'success' && extractedData && (
        <div className="ocr-success-panel">
          <div className="ocr-success-header">
            <div className="ocr-success-badge">
              <CheckCircle2 size={18} />
              <span>{isEn ? 'Document Verified & Form Populated' : 'تم استخراج البيانات وملء الحقول بنجاح'}</span>
            </div>
            <button
              type="button"
              className="ocr-reset-button"
              onClick={handleReset}
              title={isEn ? 'Scan Another' : 'مسح مستند آخر'}
            >
              <RefreshCw size={15} />
              <span>{isEn ? 'Scan Another' : 'مسح مستند آخر'}</span>
            </button>
          </div>

          <div className="ocr-extracted-grid">
            <div className="ocr-data-item">
              <label>{isEn ? 'Document Type' : 'نوع المستند'}</label>
              <div className="ocr-val-pill">
                {docIcon(extractedData.documentType)}
                <strong>{docLabel(extractedData.documentType)}</strong>
              </div>
            </div>

            <div className="ocr-data-item">
              <label>{isEn ? 'Full Name' : 'الاسم الكامل'}</label>
              <span className="ocr-val highlight">{extractedData.name}</span>
            </div>

            {extractedData.identifier && (
              <div className="ocr-data-item">
                <label>{isEn ? 'ID / Document No' : 'رقم الوثيقة / الهوية'}</label>
                <span className="ocr-val font-mono">{extractedData.identifier}</span>
              </div>
            )}

            {extractedData.dateOfBirth && (
              <div className="ocr-data-item">
                <label>{isEn ? 'Date of Birth' : 'تاريخ الميلاد'}</label>
                <span className="ocr-val font-mono">{extractedData.dateOfBirth}</span>
              </div>
            )}

            {extractedData.nationality && (
              <div className="ocr-data-item">
                <label>{isEn ? 'Nationality' : 'الجنسية'}</label>
                <span className="ocr-val">{extractedData.nationality}</span>
              </div>
            )}

            {extractedData.industry && (
              <div className="ocr-data-item">
                <label>{isEn ? 'Business Activity' : 'النشاط الاقتصادي'}</label>
                <span className="ocr-val">{extractedData.industry}</span>
              </div>
            )}
          </div>

          <div className="ocr-success-footer">
            <div className="ocr-conf-badge">
              <ShieldCheck size={16} />
              <span>
                {isEn ? `Extraction Confidence: ${extractedData.confidence}%` : `دقة الاستخراج: ${extractedData.confidence}% (عالية)`}
              </span>
            </div>
            <span className="ocr-scroll-hint">
              {isEn ? 'Review the auto-filled fields below and save' : 'تم ملء الحقول تلقائياً بالأسفل، يمكنك مراجعتها وحفظ العميل'}
              <ChevronRight size={15} />
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="ocr-error-panel">
          <AlertCircle size={20} />
          <div>
            <strong>{isEn ? 'Failed to read document' : 'تعذر استخراج بيانات المستند'}</strong>
            <p>{errorMsg || (isEn ? 'Please try another clearer image or use one of the demo presets.' : 'يرجى تجربة صورة أوضح أو تجربة النماذج التجريبية الجاهزة.')}</p>
          </div>
          <button type="button" className="button secondary small" onClick={handleReset}>
            {isEn ? 'Try Again' : 'المحاولة مجدداً'}
          </button>
        </div>
      )}

      {/* Hidden File & Camera Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        className="hidden"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
