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
  FileText,
  ShieldCheck
} from 'lucide-react';
import type { BulkScreeningResult } from '@/lib/bulk-screening';

export default function BulkScreeningClient({
  hasMonitoringFeature = false,
  locale = 'ar'
}: {
  hasMonitoringFeature?: boolean;
  locale?: string;
}) {
  const isEn = locale === 'en';
  const [file, setFile] = useState<File | null>(null);
  const [autoEnroll, setAutoEnroll] = useState(false);
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
      setError(isEn ? 'Please choose an Excel or CSV file first.' : 'يرجى اختيار ملف Excel أو CSV أولاً');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (autoEnroll) {
          formData.append('autoEnroll', '1');
        }

        const res = await fetch('/api/bulk-screen', {
          method: 'POST',
          body: formData
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || (isEn ? 'Failed to process bulk screening file.' : 'فشلت معالجة الملف'));
        }

        setData(json);
      } catch (err: any) {
        setError(err?.message || (isEn ? 'An error occurred during screening.' : 'حدث خطأ أثناء معالجة الملف'));
      }
    });
  };

  const handleExport = async () => {
    if (!data?.results) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/bulk-screen?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: data.results })
      });

      if (!res.ok) throw new Error('فشل تصدير التقرير');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DRM_Screening_Results_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تصدير التقرير');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredResults = data?.results.filter(r => {
    if (filter === 'flagged') return r.status === 'flagged';
    if (filter === 'clear') return r.status === 'clear';
    return true;
  }) || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-heading" style={{ marginBottom: '24px' }}>
        <div>
          <div className="eyebrow">{isEn ? 'High-Volume Operations' : 'عمليات الامتثال المجمعة'}</div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={28} style={{ color: '#007527' }} />
            <span>{isEn ? 'Bulk Watchlist Screening' : 'الفحص الجماعي عبر ملفات الإكسل'}</span>
          </h1>
          <p>
            {isEn
              ? 'Upload spreadsheets (Excel/CSV) to batch screen customers and entities against all official watchlists with FATF jurisdiction risk evaluation.'
              : 'رفع ملفات الجداول (Excel أو CSV) لفحص مئات العملاء والشركات دفعة واحدة ضد كافة القوائم الرسمية مع تقييم مخاطر FATF.'}
          </p>
        </div>
        <div className="heading-actions">
          <a
            href="/api/bulk-screen?action=template"
            className="button secondary sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>{isEn ? 'Download Excel Template' : 'تحميل نموذج الإكسل الجاهز'}</span>
          </a>
        </div>
      </div>

      {/* Upload Box */}
      <div className="panel" style={{ padding: '28px', marginBottom: '24px' }}>
        <form onSubmit={handleSubmit}>
          <div
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '36px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease'
            }}
            onClick={() => document.getElementById('bulk-file-input')?.click()}
          >
            <input
              id="bulk-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <UploadCloud size={44} style={{ color: '#64748b', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
              {file ? file.name : (isEn ? 'Click or drag Excel / CSV file here' : 'اضغط هنا لاختيار ملف الإكسل أو اسحبه إلى المربع')}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB`
                : (isEn ? 'Supports .xlsx, .xls, and .csv with automatic column detection' : 'يدعم صيغ .xlsx و .xls و .csv مع كشف تلقائي للأعمدة')}
            </p>
          </div>

          {hasMonitoringFeature && (
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="auto-enroll-check"
                type="checkbox"
                checked={autoEnroll}
                onChange={e => setAutoEnroll(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#007527', cursor: 'pointer' }}
              />
              <label htmlFor="auto-enroll-check" style={{ fontSize: '13px', color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} style={{ color: '#16a34a' }} />
                <span>{isEn ? 'Automatically enroll screened profiles into 24/7 Ongoing Surveillance' : 'تفعيل المراقبة المستمرة التلقائية 24/7 لكافة الأسماء المفحوصة في هذا الملف'}</span>
              </label>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {file && (
              <button
                type="button"
                className="button secondary sm"
                onClick={() => {
                  setFile(null);
                  setData(null);
                  setError(null);
                }}
              >
                {isEn ? 'Clear' : 'إلغاء'}
              </button>
            )}
            <button
              type="submit"
              disabled={isPending || !file}
              className="button primary sm"
              style={{ minWidth: '160px' }}
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>{isEn ? 'Screening names...' : 'جاري فحص الأسماء...'}</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>{isEn ? 'Start Bulk Screening' : 'بدء الفحص الجماعي الآن'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Overview */}
      {data && (
        <div>
          {/* Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <div className="panel" style={{ padding: '18px 22px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                {isEn ? 'Total Screened' : 'إجمالي الأسماء المفحوصة'}
              </span>
              <strong style={{ fontSize: '28px', color: '#0f172a' }}>{data.total}</strong>
            </div>

            <div className="panel" style={{ padding: '18px 22px', borderInlineStart: '4px solid #16a34a' }}>
              <span style={{ fontSize: '12px', color: '#166534', display: 'block', marginBottom: '4px' }}>
                {isEn ? 'Clear (No hits)' : 'سليمة (لا توجد مطابقات)'}
              </span>
              <strong style={{ fontSize: '28px', color: '#16a34a' }}>{data.clear}</strong>
            </div>

            <div className="panel" style={{ padding: '18px 22px', borderInlineStart: '4px solid #dc2626' }}>
              <span style={{ fontSize: '12px', color: '#991b1b', display: 'block', marginBottom: '4px' }}>
                {isEn ? 'Flagged (Hits / High Risk)' : 'مشبوهة (مطابقات / مخاطر)'}
              </span>
              <strong style={{ fontSize: '28px', color: '#dc2626' }}>{data.flagged}</strong>
            </div>
          </div>

          {/* Results Table Panel */}
          <div className="panel">
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`button sm ${filter === 'all' ? 'primary' : 'secondary'}`}
                  style={{ height: '34px', minHeight: '34px', padding: '0 12px', fontSize: '11px' }}
                >
                  {isEn ? `All (${data.total})` : `الكل (${data.total})`}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('flagged')}
                  className={`button sm ${filter === 'flagged' ? 'primary' : 'secondary'}`}
                  style={{
                    height: '34px',
                    minHeight: '34px',
                    padding: '0 12px',
                    fontSize: '11px',
                    ...(filter === 'flagged' ? { background: '#dc2626', borderColor: '#dc2626' } : {})
                  }}
                >
                  {isEn ? `Flagged (${data.flagged})` : `المشبوهة (${data.flagged})`}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('clear')}
                  className={`button sm ${filter === 'clear' ? 'primary' : 'secondary'}`}
                  style={{ height: '34px', minHeight: '34px', padding: '0 12px', fontSize: '11px' }}
                >
                  {isEn ? `Clear (${data.clear})` : `السليمة (${data.clear})`}
                </button>
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="button secondary sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', minHeight: '34px' }}
              >
                {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                <span>{isEn ? 'Export Results to Excel' : 'تصدير النتائج كملف إكسل كامل'}</span>
              </button>
            </div>

            {/* Table */}
            <div className="table-scroll">
              <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                    <th>{isEn ? 'Name' : 'الاسم المدخل'}</th>
                    <th>{isEn ? 'Jurisdiction / FATF' : 'الدولة / مخاطر FATF'}</th>
                    <th>{isEn ? 'Screening Status' : 'نتيجة الفحص'}</th>
                    <th>{isEn ? 'Top Match / Details' : 'أعلى تطابق والقوائم'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => (
                    <tr key={i} style={{ background: r.status === 'flagged' ? '#fff5f5' : undefined }}>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{r.rowNumber}</td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{r.name}</strong>
                        {r.identifier && (
                          <small style={{ display: 'block', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {r.identifier}
                          </small>
                        )}
                      </td>
                      <td>
                        <span>{r.country || 'N/A'}</span>
                        {r.fatfRating !== 'standard' && (
                          <span
                            style={{
                              marginInlineStart: '6px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600,
                              background: r.fatfRating === 'blacklist' ? '#fde2e4' : '#fff3cd',
                              color: r.fatfRating === 'blacklist' ? '#b91c1c' : '#856404'
                            }}
                          >
                            {r.fatfTitleEn}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: r.status === 'flagged' ? '#fee2e2' : '#dcfce7',
                            color: r.status === 'flagged' ? '#991b1b' : '#166534'
                          }}
                        >
                          {r.status === 'flagged' ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                          <span>{r.status === 'flagged' ? (isEn ? 'HIT' : 'اشتباه') : (isEn ? 'CLEAR' : 'سليم')}</span>
                        </span>
                      </td>
                      <td>
                        {r.topMatchName ? (
                          <div>
                            <span style={{ fontWeight: 500, color: '#334155' }}>{r.topMatchName}</span>
                            <small style={{ display: 'block', color: '#64748b' }}>
                              {r.topMatchSource} · تطابق {r.maxScore}%
                            </small>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>{isEn ? 'No matches' : 'لا توجد قيود'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
