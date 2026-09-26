import { Files, ScanSearch, ClipboardCheck, LockKeyhole, ShieldCheck, Award, AlertTriangle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth';
import { getMessages, getLocale } from '@/lib/i18n';
import { getSystemLockdown } from '@/lib/platform';
import LoginForm from '@/components/login-form';
import LanguageToggle from '@/components/language-toggle';

export const dynamic = 'force-dynamic';

export default async function Login() {
  if (await currentActor()) redirect('/');
  const [m, locale, lockdown] = await Promise.all([getMessages(), getLocale(), getSystemLockdown()]);
  const isAr = locale === 'ar';

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="login-orbit orbit-one" aria-hidden="true" />
        <div className="login-orbit orbit-two" aria-hidden="true" />
        <div className="login-grid" aria-hidden="true" />

        <div className="brand login-brand">
          <span className="brand-symbol">
            <img src="/drm-logo.png" alt="DRM - Diligence Risk Management" width={56} height={24} />
          </span>
          <span>
            <b>DRM</b>
            <small>{isAr ? 'دي آر إم لإدارة المخاطر والخدمات المهنية' : m.brandTagline}</small>
          </span>
        </div>

        <div className="story-content">
          <span className="story-label">
            <i aria-hidden="true" />
            {m.loginStoryLabel}
          </span>
          <h1>
            {m.loginH1a}
            <br />
            {m.loginH1b}
          </h1>
          <p>{m.loginStoryP}</p>

          <div className="story-flow">
            <div>
              <span className="flow-icon" aria-hidden="true">
                <Files size={19} />
              </span>
              <span>{m.flowProfiles}</span>
              <small>{m.flowProfilesSub}</small>
            </div>
            <div>
              <span className="flow-icon" aria-hidden="true">
                <ScanSearch size={19} />
              </span>
              <span>{m.flowScreening}</span>
              <small>{m.flowScreeningSub}</small>
            </div>
            <div>
              <span className="flow-icon" aria-hidden="true">
                <ClipboardCheck size={19} />
              </span>
              <span>{m.flowReview}</span>
              <small>{m.flowReviewSub}</small>
            </div>
          </div>

          <div className="login-leadership-note">
            <span>
              <Award size={15} aria-hidden="true" />
              {m.loginLeadershipTitle}
            </span>
            <small>
              {m.loginLeadershipSub}
            </small>
          </div>
        </div>

        <div className="story-footer">
          <span className="story-footer-icon" aria-hidden="true">
            <LockKeyhole size={14} />
          </span>
          <span>
            {isAr
              ? 'المقر الرئيسي: بناية سلطان للاستثمار، ديرة، دبي · هاتف: '
              : 'Dubai HQ: Sultan Business Centre, Deira · Tel: '}
          </span>
          <bdi dir="ltr">+971 55 761 0818</bdi>
        </div>
      </section>

      <section className="login-side">
        <div className="login-side-aura" aria-hidden="true" />
        <div className="login-side-top">
          <LanguageToggle />
        </div>
        <div className="login-side-content">
          <div className="login-card">
            <div className="login-card-mark">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{m.loginBadgeTag}</span>
            </div>
            <h2>{m.loginWelcome}</h2>
            <p>{m.loginSub}</p>
            {lockdown.enabled && (
              <div className="maintenance-login-banner" role="alert" style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '0.75rem 0.9rem',
                marginBottom: '1rem',
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'flex-start',
                fontSize: '0.82rem',
                lineHeight: '1.45',
                color: 'var(--text, #1e293b)'
              }}>
                <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.2rem' }}>
                    {isAr ? 'النظام في وضع الصيانة والتوقف المؤقت' : 'System Currently Under Maintenance'}
                  </strong>
                  <span>
                    {isAr
                      ? (lockdown.message_ar || 'تم إيقاف دخول واستخدام المنظومة مؤقتاً لأعمال التحديث. تسجيل الدخول متاح فقط لحساب الإدارة العليا (Super Admin).')
                      : (lockdown.message_en || 'The platform is temporarily suspended for maintenance. Sign-in is restricted exclusively to Super-Admin.')}
                  </span>
                </div>
              </div>
            )}
            <LoginForm />
            <div className="login-card-foot">
              <LockKeyhole size={14} aria-hidden="true" />
              <span>{m.loginDisclaimer}</span>
            </div>
          </div>
          <footer className="login-footer" dir="ltr">
            <bdi dir="ltr">
              Developed by{' '}
              <a
                href="https://linktr.ee/ahmedabdelnaby"
                target="_blank"
                rel="noopener noreferrer"
                className="developer-link"
              >
                Ahmed Abdelnaby
              </a>
            </bdi>
          </footer>
        </div>
      </section>
    </div>
  );
}
