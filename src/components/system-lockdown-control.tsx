'use client';

import { useState } from 'react';
import { Power, ShieldAlert, ShieldCheck, AlertTriangle, RefreshCw, MessageSquare, ExternalLink } from 'lucide-react';
import type { SystemLockdown } from '@/lib/platform';
import { toggleSystemLockdownAction } from '@/app/actions';

export default function SystemLockdownControl({
  lockdown,
  locale
}: {
  lockdown: SystemLockdown;
  locale: string;
}) {
  const isAr = locale === 'ar';
  const isLocked = lockdown.enabled;
  const [loading, setLoading] = useState(false);
  const [showCustomMsg, setShowCustomMsg] = useState(false);
  const [messageAr, setMessageAr] = useState(lockdown.message_ar || '');
  const [messageEn, setMessageEn] = useState(lockdown.message_en || '');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isLocked) {
      const confirmText = isAr
        ? '⚠️ هل أنت متأكد من تعطيل النظام بالكامل؟\n\nسيتم منع تسجيل الدخول واستخدام النظام لجميع المستخدمين والمؤسسات فوراً، ولن يتمكن أحد من الدخول سوى حسابك أنت فقط كسوبر أدمن.'
        : '⚠️ Are you sure you want to lock down the entire system?\n\nSign-in and access will be immediately blocked for all users across all organizations. Only your Super Admin account will retain access.';
      if (!window.confirm(confirmText)) {
        e.preventDefault();
        return;
      }
    }
    setLoading(true);
  };

  return (
    <section className={`panel system-lockdown-panel ${isLocked ? 'is-locked-down' : 'is-operational'}`}>
      <div className="system-lockdown-head">
        <div className="system-lockdown-title-wrap">
          <div className={`system-lockdown-icon ${isLocked ? 'icon-locked' : 'icon-operational'}`}>
            {isLocked ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div>
            <h2>
              {isAr ? 'حالة تشغيل المنظومة والتحكم العام' : 'Platform Operational Status & Lockdown'}
            </h2>
            <p>
              {isAr
                ? 'تحكم كامل من السوبر أدمن في إتاحة أو إيقاف المنظومة بالكامل أمام جميع المستخدمين والمؤسسات.'
                : 'Super-Admin platform-wide switch to permit or suspend user access for maintenance or security.'}
            </p>
          </div>
        </div>

        <div className="system-lockdown-badge-wrap">
          <span className={`system-status-indicator ${isLocked ? 'badge-locked' : 'badge-operational'}`}>
            <span className="status-ping-dot" />
            <strong>
              {isLocked
                ? (isAr ? 'النظام معطّل (وضع الصيانة)' : 'System Locked Down')
                : (isAr ? 'النظام يعمل بشكل طبيعي' : 'System Operational')}
            </strong>
          </span>
        </div>
      </div>

      <div className="system-lockdown-body">
        {isLocked ? (
          <div className="system-lockdown-alert alert-warning">
            <AlertTriangle size={18} />
            <div className="alert-text">
              <strong>
                {isAr
                  ? 'المنظومة مغلقة حالياً أمام المستخدمين'
                  : 'Platform is currently suspended for regular users'}
              </strong>
              <p>
                {isAr
                  ? 'تم حظر تسجيل الدخول لأي مستخدم أو محلل أو أدمن آخر. أنت الآن متصل بصلاحية السوبر أدمن الحصرية، ويمكنك إعادة تشغيل المنظومة متى شئت بالضغط على الزر أدناه.'
                  : 'All sign-ins and workspace access for regular users are disabled. You are authenticated with exclusive Super-Admin privileges. You can re-enable the system whenever ready.'}
              </p>
              {lockdown.updated_at && (
                <small className="muted" dir="ltr">
                  {isAr ? 'تم التعطيل منذ: ' : 'Suspended at: '}
                  {new Date(lockdown.updated_at).toLocaleString(isAr ? 'ar-AE-u-nu-latn' : 'en-US')}
                </small>
              )}
            </div>
          </div>
        ) : (
          <div className="system-lockdown-alert alert-info">
            <ShieldCheck size={18} />
            <div className="alert-text">
              <strong>
                {isAr ? 'جميع الخدمات تعمل بصورة طبيعية' : 'All systems and tenant access active'}
              </strong>
              <p>
                {isAr
                  ? 'يمكن لكافة أعضاء الفريق والمحللين والمستخدمين تسجيل الدخول وإجراء الفحوصات والعمل بصورة اعتيادية.'
                  : 'Team members and analysts across all subscribed organizations have active access to search and screening.'}
              </p>
            </div>
          </div>
        )}

        <form action={toggleSystemLockdownAction} onSubmit={handleSubmit} className="system-lockdown-form">
          <input type="hidden" name="enabled" value={isLocked ? 'false' : 'true'} />

          {!isLocked && (
            <div className="custom-msg-accordion">
              <button
                type="button"
                className="text-link text-sm"
                onClick={() => setShowCustomMsg(!showCustomMsg)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'none', border: 'none', padding: '0.2rem 0' }}
              >
                <MessageSquare size={14} />
                <span>
                  {showCustomMsg
                    ? (isAr ? 'إخفاء رسالة الصيانة المخصصة' : 'Hide custom maintenance message')
                    : (isAr ? 'إضافة رسالة صيانة مخصصة تظهر للمستخدمين (اختياري)' : 'Add custom maintenance message for users (optional)')}
                </span>
              </button>

              {showCustomMsg && (
                <div className="custom-msg-fields" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>
                      {isAr ? 'رسالة الصيانة (بالعربية):' : 'Maintenance message (Arabic):'}
                    </label>
                    <input
                      type="text"
                      name="messageAr"
                      dir="rtl"
                      value={messageAr}
                      onChange={e => setMessageAr(e.target.value)}
                      placeholder="مثال: نقوم حالياً بتحديث قواعد بيانات العقوبات الدولية، سنعود قريباً."
                      style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>
                      {isAr ? 'رسالة الصيانة (بالإنجليزية):' : 'Maintenance message (English):'}
                    </label>
                    <input
                      type="text"
                      name="messageEn"
                      dir="ltr"
                      value={messageEn}
                      onChange={e => setMessageEn(e.target.value)}
                      placeholder="e.g. Scheduled international sanction database upgrade in progress. Back soon."
                      style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="lockdown-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
            {isLocked ? (
              <>
                <button
                  type="submit"
                  disabled={loading}
                  className="button primary"
                  style={{ background: 'var(--success, #10b981)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, padding: '0.6rem 1.2rem' }}
                >
                  {loading ? <RefreshCw size={16} className="spin" /> : <Power size={16} />}
                  <span>{isAr ? 'تشغيل النظام واستئناف العمل للجميع' : 'Re-enable System & Resume Access'}</span>
                </button>
                <a
                  href="/login?preview=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, padding: '0.6rem 1rem', textDecoration: 'none' }}
                >
                  <ExternalLink size={15} />
                  <span>{isAr ? 'معاينة شاشة الدخول في وضع الصيانة ↗' : 'Preview Lockdown Login Page ↗'}</span>
                </a>
              </>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="button danger"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, padding: '0.6rem 1.2rem' }}
              >
                {loading ? <RefreshCw size={16} className="spin" /> : <Power size={16} />}
                <span>{isAr ? 'تعطيل النظام بالكامل (وضع الصيانة)' : 'Lockdown Entire System (Maintenance Mode)'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
