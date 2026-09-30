'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Search,
  Loader2,
  CheckCircle,
  FileText
} from 'lucide-react';
import type { BulkScreeningResult } from '@/lib/bulk-screening';

export default function BulkScreeningPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    total: number;
    flagged: number;
    clear: number;
    results: BulkScreeningResult[];
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'flagged' | 'clear'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('يرجى اختيار ملف Excel أو CSV أولاً');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/bulk-screen', {
          method: 'POST',
          body: formData
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'فشلت معالجة الملف');
        }

        setData(json);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ غير متوقع أثناء فحص الملف');
      }
    });
  };

  const handleExport = async () => {
    if (!data || !data.results.length) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/bulk-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', results: data.results })
      });

      if (!res.ok) throw new Error('فشل تحميل التقرير');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DRM_Bulk_Screening_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || 'فشل تصدير التقرير');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredResults = data?.results.filter(r => {
    if (filter === 'flagged') return r.status === 'flagged';
    if (filter === 'clear') return r.status === 'clear';
    return true;
  }) ?? [];

  return (
    <>
      {/* Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">DRM Enterprise · Batch Screening</div>
          <h1>الفحص الجماعي بالدفعات (Bulk Screening)</h1>
          <p>فحص مئات الأسماء والشركات دفعة واحدة عبر ملف Excel / CSV مع كشف مطابقات العقوبات ومخاطر FATF فوراً.</p>
        </div>
        <div className="heading-actions">
          <Link href="/search" className="button secondary">
            <Search size={15} />
            <span>البحث الفردي</span>
          </Link>
          <a href="/api/bulk-screen?action=template" download="DRM_Screening_Template.xlsx" className="button secondary">
            <Download size={15} />
            <span>تحميل نموذج Excel الجاهز</span>
          </a>
        </div>
      </div>

      {/* Upload Panel */}
      <section className="panel" style={{ marginBottom: '24px', padding: '24px' }}>
        <form onSubmit={handleSubmit}>
          <div
            className={`bulk-dropzone ${file ? 'has-file' : ''}`}
            onClick={() => document.getElementById('bulk-file-input')?.click()}
          >
            <input
              id="bulk-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {file ? (
              <FileSpreadsheet className="bulk-dropzone-icon" />
            ) : (
              <UploadCloud className="bulk-dropzone-icon" />
            )}
            <h3>
              {file ? (
                <span style={{ color: '#007527' }}>تم اختيار: {file.name}</span>
              ) : (
                'اضغط لاختيار ملف Excel أو CSV أو اسحبه هنا'
              )}
            </h3>
            <p>
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'يدعم ملفات (.xlsx, .xls, .csv) حتى 500 اسم لكل دفعة.'}
            </p>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13.5px',
                marginBottom: '18px'
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="bulk-actions-wrap">
            {file && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setFile(null)}
                disabled={isPending}
              >
                إلغاء الملف
              </button>
            )}
            <button
              type="submit"
              className="button primary"
              disabled={!file || isPending}
              style={{ minWidth: '180px' }}
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>جاري الفحص الآلي...</span>
                </>
              ) : (
                'بدء فحص الدفعة الآن'
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Results Dashboard */}
      {data && (
        <section className="panel" style={{ padding: '24px' }}>
          {/* Summary Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}
          >
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>إجمالي الأسماء المفحوصة</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {data.total}
              </div>
            </div>

            <div style={{ background: '#f0fdf4', padding: '16px 20px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>سليم بدون مطابقات (Clear)</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
                {data.clear}
              </div>
            </div>

            <div style={{ background: '#fffbeb', padding: '16px 20px', borderRadius: '10px', border: '1px solid #fde68a' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#b45309' }}>مطابقات محتملة / تنبيهات (Flagged)</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                {data.flagged}
              </div>
            </div>
          </div>

          {/* Table Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`button sm ${filter === 'all' ? 'primary' : 'secondary'}`}
                onClick={() => setFilter('all')}
              >
                الكل ({data.total})
              </button>
              <button
                type="button"
                className={`button sm ${filter === 'flagged' ? 'primary' : 'secondary'}`}
                onClick={() => setFilter('flagged')}
              >
                المطابقات فقط ({data.flagged})
              </button>
              <button
                type="button"
                className={`button sm ${filter === 'clear' ? 'primary' : 'secondary'}`}
                onClick={() => setFilter('clear')}
              >
                السليم فقط ({data.clear})
              </button>
            </div>

            <button
              type="button"
              className="button secondary sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              <FileSpreadsheet size={15} style={{ color: '#007527' }} />
              <span>{isExporting ? 'جاري إنشاء التقرير...' : 'تصدير تقرير النتائج إلى Excel'}</span>
            </button>
          </div>

          {/* Results Table */}
          <div className="table-scroll">
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  <th>الاسم المفحوص</th>
                  <th>النوع</th>
                  <th>الدولة و FATF</th>
                  <th>الحالة الرقابية</th>
                  <th>أعلى نسبة تطابق</th>
                  <th>أول قائمة مطابقة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: '#94a3b8' }}>{r.rowNumber}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ textTransform: 'capitalize', color: '#64748b' }}>
                      {r.entityType === 'company' ? 'شركة' : 'فرد'}
                    </td>
                    <td>
                      {r.country ? (
                        <span
                          className={`fatf-badge ${
                            r.fatfRating === 'blacklist'
                              ? 'fatf-blacklist'
                              : r.fatfRating === 'greylist'
                              ? 'fatf-greylist'
                              : 'fatf-standard'
                          }`}
                          style={{ fontSize: '10.5px', padding: '2px 6px' }}
                        >
                          {r.country} · {r.fatfRating.toUpperCase()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {r.status === 'clear' ? (
                        <span className="idenfo-tag hit-no">سليم (Clear)</span>
                      ) : (
                        <span className={`idenfo-tag ${r.riskBand === 'high' ? 'hit-sanction' : 'hit-warning'}`}>
                          مطابقة محتملة
                        </span>
                      )}
                    </td>
                    <td dir="ltr" style={{ fontWeight: 700 }}>
                      {r.maxScore > 0 ? `${r.maxScore}%` : '—'}
                    </td>
                    <td style={{ color: '#475569' }}>
                      {r.topMatchSource ? `${r.topMatchSource} (${r.topMatchName})` : '—'}
                    </td>
                    <td>
                      <Link
                        href={`/search?q=${encodeURIComponent(r.name)}`}
                        target="_blank"
                        className="button secondary sm"
                        style={{ minHeight: '32px', padding: '4px 10px', fontSize: '11px' }}
                      >
                        فحص تفصيلي
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
