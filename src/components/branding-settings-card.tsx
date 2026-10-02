'use client';

import { useState } from 'react';
import {
  Palette,
  Upload,
  CheckCircle2,
  Building,
  FileCheck2,
  Image as ImageIcon,
  Save,
  Loader2,
  Sparkles,
  Eye,
  ShieldCheck,
  Globe2,
} from 'lucide-react';
import { type OrganizationBranding, DEFAULT_BRANDING } from '@/lib/branding-types';
import type { Locale } from '@/lib/i18n';

interface Props {
  initialBranding: OrganizationBranding;
  organizationName: string;
  locale?: Locale;
}

export default function BrandingSettingsCard({
  initialBranding,
  organizationName,
  locale = 'ar',
}: Props) {
  const isEn = locale === 'en';
  const [branding, setBranding] = useState<OrganizationBranding>({
    ...initialBranding,
    companyName: initialBranding.companyName || organizationName,
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject non-images and oversized files before encoding (server re-validates).
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/i.test(file.type)) {
      alert(isEn ? 'Please upload a PNG, JPG, SVG or WebP image.' : 'يرجى رفع صورة بصيغة PNG أو JPG أو SVG أو WebP.');
      e.target.value = '';
      return;
    }
    if (file.size > 1024 * 1024) {
      alert(isEn ? 'Logo is too large (max 1 MB).' : 'حجم الشعار كبير جداً (الحد الأقصى 1 ميجابايت).');
      e.target.value = '';
      return;
    }

    // Convert to base64 Data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBranding((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Error saving branding:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="branding-settings-panel">
      <div className="analytics-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Palette size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{isEn ? 'White-labeling & Official Report Branding' : 'تخصيص الهوية البصرية وشعار المؤسسة على التقارير (White-labeling)'}</span>
              <span className="analytics-live-pill">
                {isEn ? 'Enterprise Feature' : 'ميزة المؤسسات'}
              </span>
            </h3>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0' }}>
              {isEn
                ? 'Display your official firm logo, legal entity name, and license details on all PDF & Dossier compliance reports.'
                : 'إظهار الشعار الرسمي لشركتك، الاسم التجاري، ورقم الترخيص المعتمد على جميع تقارير وشهادات الامتثال الصادرة للجهات الرقابية.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPreviewMode(!previewMode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          <Eye size={14} />
          <span>{previewMode ? (isEn ? 'Edit Form' : 'نموذج التعديل') : (isEn ? 'Preview Report Header' : 'معاينة ترويسة التقرير')}</span>
        </button>
      </div>

      {/* Success Notification */}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '12.5px', fontWeight: 600 }}>
          <CheckCircle2 size={16} style={{ color: '#059669' }} />
          <span>{isEn ? 'Custom branding saved successfully! Applied to all reports.' : 'تم حفظ وتطبيق الهوية البصرية بنجاح على كافة التقارير وشهادات الامتثال.'}</span>
        </div>
      )}

      {/* Preview Box */}
      {previewMode ? (
        <div className="branding-preview-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" style={{ maxHeight: '44px', maxWidth: '140px', objectFit: 'contain' }} />
              ) : (
                <div style={{ height: '44px', width: '100px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                  YOUR LOGO
                </div>
              )}
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  {branding.companyName || organizationName}
                </h4>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {branding.licenseNumber && <span>{isEn ? 'Lic. No:' : 'ترخيص رقم:'} <strong>{branding.licenseNumber}</strong></span>}
                  {branding.regulatorName && <span>· {branding.regulatorName}</span>}
                </div>
              </div>
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
              OFFICIAL AUDIT REPORT
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
            {branding.customFooterNote || DEFAULT_BRANDING.customFooterNote}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="branding-form-grid">
            <div className="branding-field">
              <label>{isEn ? 'Legal Entity / Firm Name' : 'اسم المنشأة / الشركة الرسمي'}</label>
              <input
                type="text"
                value={branding.companyName || ''}
                onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                placeholder={organizationName}
              />
            </div>

            <div className="branding-field">
              <label>{isEn ? 'Commercial License Number' : 'رقم الرخصة التجارية / السجل (DED / ADGM / DIFC)'}</label>
              <input
                type="text"
                value={branding.licenseNumber || ''}
                onChange={(e) => setBranding({ ...branding, licenseNumber: e.target.value })}
                placeholder="e.g. DED-849201 / DIFC-CL4012"
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <div className="branding-field">
              <label>{isEn ? 'Official Firm Logo (PNG / SVG)' : 'شعار المنشأة (PNG / SVG)'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {branding.logoUrl && (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    style={{ height: '38px', maxWidth: '90px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e2e8f0', padding: '2px', background: '#ffffff' }}
                  />
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#334155', margin: 0 }}>
                  <Upload size={14} />
                  <span>{branding.logoUrl ? (isEn ? 'Change Logo' : 'تغيير الشعار') : (isEn ? 'Upload Logo' : 'رفع الشعار')}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            <div className="branding-field">
              <label>{isEn ? 'Supervisory / Regulatory Authority' : 'الجهة الرقابية المشرفة'}</label>
              <input
                type="text"
                value={branding.regulatorName || ''}
                onChange={(e) => setBranding({ ...branding, regulatorName: e.target.value })}
                placeholder="e.g. UAE Ministry of Economy / Central Bank"
              />
            </div>

            <div className="branding-field" style={{ gridColumn: '1 / -1' }}>
              <label>{isEn ? 'Official Report Certification Statement (Footer)' : 'نص إقرار واعتماد التقرير الصادر في التذييل'}</label>
              <input
                type="text"
                value={branding.customFooterNote || ''}
                onChange={(e) => setBranding({ ...branding, customFooterNote: e.target.value })}
                placeholder="وثيقة امتثال وتدقيق رسمية معتمدة وفق متطلبات وحدة المعلومات المالية ومصرف الإمارات المركزي."
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#007527',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 117, 39, 0.25)',
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{isEn ? 'Save Branding Settings' : 'حفظ وتطبيق الهوية البصرية'}</span>
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
