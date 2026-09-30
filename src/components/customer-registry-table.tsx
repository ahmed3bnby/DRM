'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  UserRound,
  ArrowUpLeft,
  ShieldCheck,
  Download,
  CheckSquare,
  Square,
  Loader2,
  FileArchive,
  X,
} from 'lucide-react';
import type { Customer } from '@/lib/customers';
import type { Locale, Messages } from '@/lib/i18n';
import { Status, ScreeningTag, EntityIcon, countryName, flag } from '@/components/ui';

export default function CustomerRegistryTable({
  customers,
  m,
  locale,
}: {
  customers: Customer[];
  m: Messages;
  locale: Locale;
}) {
  const isEn = locale === 'en';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!customers.length) {
    return (
      <div className="empty">
        <UserRound size={32} />
        <h3>{m.emptyTitle}</h3>
        <p>{m.emptyBody}</p>
      </div>
    );
  }

  const allSelected = customers.length > 0 && selectedIds.size === customers.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < customers.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const res = await fetch('/api/audit-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate audit package');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DRM_Compliance_Audit_Dossier_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setExportError(err.message || (isEn ? 'Export failed' : 'فشل تصدير حزمة التدقيق'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="registry-table-wrapper" style={{ position: 'relative' }}>
      {/* Floating Sticky Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div
          className="bulk-audit-bar"
          style={{
            position: 'sticky',
            top: '10px',
            zIndex: 30,
            background: '#0f172a',
            color: '#ffffff',
            borderRadius: '10px',
            padding: '12px 20px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1e293b', display: 'grid', placeItems: 'center', color: '#38bdf8' }}>
              <FileArchive size={16} />
            </div>
            <div>
              <strong style={{ fontSize: '14px', display: 'block' }}>
                {isEn ? `${selectedIds.size} customers selected for audit` : `تم تحديد ${selectedIds.size} عملاء للتفتيش والتدقيق`}
              </strong>
              <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                {isEn ? 'Will bundle KYC reports, 24/7 certificates & Excel manifest into a single ZIP archive' : 'سيتم تجميع تقارير الفحص، شهادات المراقبة الرسمية، وفهرس الإكسل في ملف مضغوط'}
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <X size={14} />
              <span>{isEn ? 'Clear' : 'إلغاء التحديد'}</span>
            </button>

            <button
              onClick={handleBulkExport}
              disabled={isExporting}
              className="button primary sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#16a34a',
                borderColor: '#16a34a',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: '6px',
              }}
            >
              {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              <span>{isExporting ? (isEn ? 'Generating ZIP...' : 'جاري تجميع الملف المضغوط...') : (isEn ? 'Export Audit Package (ZIP)' : 'تصدير حزمة التدقيق (ZIP)')}</span>
            </button>
          </div>
        </div>
      )}

      {exportError && (
        <div className="error-message" role="alert" style={{ marginBottom: '16px' }}>
          {exportError}
        </div>
      )}

      {/* Desktop Data Table */}
      <div className="table-scroll desktop-only-table">
        <table className="data-table customers-table" dir={locale === 'en' ? 'ltr' : 'rtl'}>
          <thead>
            <tr>
              <th scope="col" className="th-select">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  aria-label={isEn ? 'Select all' : 'تحديد الكل'}
                  style={{
                    background: allSelected ? '#eff6ff' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto',
                    color: allSelected ? '#2563eb' : '#94a3b8',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {allSelected ? <CheckSquare size={18} style={{ color: '#2563eb' }} /> : <Square size={18} />}
                </button>
              </th>
              <th scope="col" className="th-client">{m.thClient}</th>
              <th scope="col" className="th-type">{m.thType}</th>
              <th scope="col" className="th-country">{m.thCountry}</th>
              <th scope="col" className="th-status">{m.thStatus}</th>
              <th scope="col" className="th-screening">{m.thScreening}</th>
              <th scope="col" className="th-open"><span className="sr-only">{m.open}</span></th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => {
              const isSelected = selectedIds.has(c.id);
              return (
                <tr
                  key={c.id}
                  style={{ background: isSelected ? 'rgba(37, 99, 235, 0.04)' : undefined }}
                >
                  <td className="td-select">
                    <button
                      type="button"
                      onClick={e => toggleSelectOne(c.id, e)}
                      aria-label={`${isEn ? 'Select' : 'تحديد'} ${c.name}`}
                      style={{
                        background: isSelected ? '#eff6ff' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto',
                        color: isSelected ? '#2563eb' : '#94a3b8',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected ? <CheckSquare size={18} style={{ color: '#2563eb' }} /> : <Square size={18} />}
                    </button>
                  </td>
                  <td className="customer-name-cell" data-label={m.thClient}>
                    <Link className="customer-cell" href={`/profiles/${c.reference}`}>
                      <EntityIcon type={c.entity_type} />
                      <span className="customer-cell-text">
                        <strong dir="auto"><bdi>{c.name}</bdi></strong>
                        <small dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <bdi>{c.reference}</bdi>
                          {c.monitoring_enabled && (
                            <span title={locale === 'en' ? 'Ongoing Monitoring: Active' : 'المراقبة المستمرة: مفعّلة'} style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <ShieldCheck size={12} style={{ color: '#16a34a' }} />
                            </span>
                          )}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td className="customer-type-cell" data-label={m.thType}>
                    <span className={`entity-type ${c.entity_type === 'company' ? 'company' : 'individual'}`}>
                      {c.entity_type === 'company' ? m.entityCompany : m.entityIndividual}
                    </span>
                  </td>
                  <td className="customer-country-cell" data-label={m.thCountry}>
                    <span className="country-cell">
                      <span className="flag" aria-hidden>{flag(c.country) || '🌐'}</span>
                      <bdi className="country-name">{countryName(c.country, locale)}</bdi>
                    </span>
                  </td>
                  <td className="customer-status-cell" data-label={m.thStatus}>
                    <Status status={c.status} m={m} />
                  </td>
                  <td className="customer-screening-cell" data-label={m.thScreening}>
                    <ScreeningTag status={c.screening_status} m={m} />
                  </td>
                  <td className="row-open-cell">
                    <Link className="row-open" href={`/profiles/${c.reference}`} aria-label={`${m.open} ${c.name}`}>
                      <ArrowUpLeft size={18} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Customer Cards with Checkbox */}
      <div className="mobile-customer-cards" aria-label={m.navCustomers}>
        {customers.map(c => {
          const isSelected = selectedIds.has(c.id);
          return (
            <div
              key={c.id}
              className={`mobile-customer-card ${isSelected ? 'is-selected' : ''}`}
              style={{ position: 'relative', border: isSelected ? '1.5px solid #2563eb' : undefined }}
            >
              <div style={{ position: 'absolute', top: '12px', [locale === 'en' ? 'right' : 'left']: '12px', zIndex: 5 }}>
                <button
                  type="button"
                  onClick={e => toggleSelectOne(c.id, e)}
                  style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  {isSelected ? <CheckSquare size={16} style={{ color: '#2563eb' }} /> : <Square size={16} />}
                </button>
              </div>

              <Link href={`/profiles/${c.reference}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div className="m-card-head" style={{ paddingRight: locale === 'en' ? '36px' : undefined, paddingLeft: locale === 'ar' ? '36px' : undefined }}>
                  <EntityIcon type={c.entity_type} />
                  <div className="m-card-info">
                    <strong className="m-card-name" dir="auto"><bdi>{c.name}</bdi></strong>
                    <small className="m-card-ref" dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <bdi>{c.reference}</bdi>
                      {c.monitoring_enabled && (
                        <span title={locale === 'en' ? 'Ongoing Monitoring: Active' : 'المراقبة المستمرة: مفعّلة'} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <ShieldCheck size={12} style={{ color: '#16a34a' }} />
                        </span>
                      )}
                    </small>
                  </div>
                  <div className="m-card-screening">
                    <ScreeningTag status={c.screening_status} m={m} />
                  </div>
                </div>

                <div className="m-card-meta">
                  <span className="m-meta-chip country">
                    <span className="flag" aria-hidden>{flag(c.country) || '🌐'}</span>
                    <span className="country-name">{countryName(c.country, locale)}</span>
                  </span>
                  <span className={`m-meta-chip type ${c.entity_type === 'company' ? 'company' : 'individual'}`}>
                    {c.entity_type === 'company' ? m.entityCompany : m.entityIndividual}
                  </span>
                  <span className="m-meta-chip status">
                    <Status status={c.status} m={m} />
                  </span>
                  <span className="m-card-arrow" aria-hidden="true">
                    <ArrowUpLeft size={15} />
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
