import { Files, ScanSearch, ClipboardCheck, LockKeyhole, ShieldCheck, Award, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/auth';
import { isSuperAdminEmail, isSuperAdminId } from '@/lib/platform-access';
import { getMessages, getLocale } from '@/lib/i18n';
import { getSystemLockdown } from '@/lib/platform';
import LoginForm from '@/components/login-form';
import LanguageToggle from '@/components/language-toggle';
import { DeveloperCredit } from '@/components/developer-credit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Login({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const [actor, m, locale, lockdown] = await Promise.all([
    currentActor(),
    getMessages(),
    getLocale(),
    getSystemLockdown(),
  ]);

  const isSuperAdmin = !!actor && (isSuperAdminEmail(actor.email) || isSuperAdminId(actor.id));

  // If a regular user is already logged in (when lockdown is off), redirect to home
  if (actor && !isSuperAdmin) {
    redirect('/');
  }

  // If super admin is logged in, only redirect away if lockdown is NOT active AND not previewing
  if (actor && isSuperAdmin && !lockdown.enabled && params.preview !== '1') {
    redirect('/');
  }

  const isAr = locale === 'ar';
  const showAdminPreview = !!(actor && isSuperAdmin);
  const showTicker = lockdown.enabled;

  const contentPaddingTop = showAdminPreview && showTicker
    ? '5.6rem'
    : showAdminPreview
      ? '3.6rem'
      : showTicker
        ? '3.2rem'
        : undefined;

  const toggleTop = showAdminPreview && showTicker
    ? '5.8rem'
    : showAdminPreview
      ? '3.8rem'
      : showTicker
        ? '3.4rem'
        : '24px';

  const customMessage = isAr
    ? (lockdown.message_ar || lockdown.message_en)
    : (lockdown.message_en || lockdown.message_ar);

  const tickerItemStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 16px',
    fontSize: '12.5px',
    fontWeight: 500,
    color: '#f1f5f9',
    whiteSpace: 'nowrap',
  };

  const tickerSepStyle: React.CSSProperties = {
    opacity: 0.45,
    color: '#ef4444',
    fontSize: '10px',
    userSelect: 'none',
  };

  const tickerCycle = (
    <>
      <span style={tickerItemStyle} dir={isAr ? 'rtl' : 'ltr'}>
        ⚠️ <strong style={{ color: '#fef08a', fontWeight: 700 }}>
          {isAr ? 'النظام في وضع الصيانة والتحديث المؤقت' : 'System Currently Under Maintenance'}
        </strong>
      </span>
      <span style={tickerSepStyle}>✦</span>

      {customMessage && (
        <>
          <span style={tickerItemStyle} dir={isAr ? 'rtl' : 'ltr'}>
            📢 <strong style={{ color: '#fef08a', fontWeight: 700 }}>{customMessage}</strong>
          </span>
          <span style={tickerSepStyle}>✦</span>
        </>
      )}

      <span style={tickerItemStyle} dir={isAr ? 'rtl' : 'ltr'}>
        🔒 {isAr ? 'تحديث شامل لقواعد بيانات العقوبات الدولية وقوائم الامتثال' : 'Comprehensive sanctions database update in progress'}
      </span>
      <span style={tickerSepStyle}>✦</span>

      <span style={tickerItemStyle} dir="ltr">
        ABC · Compliance & Advisory
      </span>
      <span style={tickerSepStyle}>✦</span>

      <span style={tickerItemStyle} dir={isAr ? 'rtl' : 'ltr'}>
        🛡️ {isAr ? 'سنعود للعمل فور اكتمال أعمال الترقية' : 'Services will resume shortly upon completion'}
      </span>
      <span style={tickerSepStyle}>✦</span>
    </>
  );

  return (
    <div className="login-page">
      {/* 1. Bulletproof Self-Contained Moving Header Announcement Bar (Ticker) */}
      {showTicker && (
        <>
          <style>{`
            @keyframes drmTickerScroll {
              0% { transform: translate3d(0, 0, 0); }
              100% { transform: translate3d(-50%, 0, 0); }
            }
            @keyframes drmTickerPulse {
              0% { transform: scale(0.95); opacity: 0.85; }
              50% { transform: scale(1.15); opacity: 1; }
              100% { transform: scale(0.95); opacity: 0.85; }
            }
            .drm-ticker-container:hover .drm-ticker-track {
              animation-play-state: paused !important;
            }
            .drm-ticker-track {
              -webkit-backface-visibility: hidden;
              backface-visibility: hidden;
              transform: translate3d(0, 0, 0);
            }
          `}</style>
          <aside
            className="drm-ticker-container"
            dir="ltr"
            role="marquee"
            aria-live="polite"
            title={isAr ? 'مرّر المؤشر لإيقاف حركة الشريط' : 'Hover to pause ticker'}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              height: '38px',
              maxHeight: '38px',
              background: '#090d16',
              borderBottom: '2px solid #ef4444',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
          >
            {/* Fixed Alert Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: '#dc2626',
                color: '#ffffff',
                padding: '0 16px',
                height: '100%',
                fontSize: '11.5px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                zIndex: 10,
                boxShadow: isAr ? '-2px 0 12px rgba(0, 0, 0, 0.5)' : '2px 0 12px rgba(0, 0, 0, 0.5)',
                order: isAr ? 2 : 1,
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  animation: 'drmTickerPulse 1.8s infinite',
                }}
              />
              <span>{isAr ? 'تنبيه إداري' : 'System Alert'}</span>
            </div>

            {/* Viewport for Moving Track */}
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                position: 'relative',
                order: isAr ? 1 : 2,
              }}
            >
              <div
                className="drm-ticker-track"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  direction: 'ltr',
                  width: 'max-content',
                  willChange: 'transform',
                  animation: 'drmTickerScroll 50s linear infinite',
                }}
              >
                {/* Loop Block 1 */}
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {tickerCycle}
                  {tickerCycle}
                  {tickerCycle}
                  {tickerCycle}
                </div>

                {/* Loop Block 2 (Exact duplicate for seamless continuous flow) */}
                <div
                  aria-hidden="true"
                  style={{ display: 'flex', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {tickerCycle}
                  {tickerCycle}
                  {tickerCycle}
                  {tickerCycle}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* 2. If Super Admin is viewing this page while authenticated */}
      {showAdminPreview && (
        <aside
          role="status"
          style={{
            position: 'fixed',
            top: showTicker ? '38px' : 0,
            left: 0,
            right: 0,
            zIndex: 9998,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            color: '#f8fafc',
            borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
            padding: '0.65rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            fontSize: '0.85rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                background: 'rgba(245, 158, 11, 0.25)',
                color: '#f59e0b',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              👑 {isAr ? 'معاينة الإدارة العليا' : 'Super Admin Preview'}
            </span>
            <span style={{ color: '#cbd5e1' }}>
              {isAr
                ? `أنت متصل بصلاحية السوبر أدمن (${actor.displayName}). يتم عرض هذه الشاشة لمعاينة شاشة الدخول في وضع التعطيل.`
                : `Signed in as Super Admin (${actor.displayName}). Viewing the lockdown login screen.`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexShrink: 0 }}>
            <Link
              href="/"
              className="button small primary"
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              {isAr ? 'الذهاب للوحة التحكم ←' : 'Go to Dashboard →'}
            </Link>
          </div>
        </aside>
      )}

      <section
        className="login-story"
        style={contentPaddingTop ? { paddingTop: contentPaddingTop } : undefined}
      >
        <div className="login-orbit orbit-one" aria-hidden="true" />
        <div className="login-orbit orbit-two" aria-hidden="true" />
        <div className="login-grid" aria-hidden="true" />

        <div className="brand login-brand">
          <span className="brand-symbol brand-wordmark">ABC</span>
          <span>
            <b>ABC</b>
            <small>{isAr ? 'للاستشارات والامتثال' : m.brandTagline}</small>
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
            <small>{m.loginLeadershipSub}</small>
          </div>
        </div>

        <div className="story-footer">
          <span className="story-footer-icon" aria-hidden="true">
            <LockKeyhole size={14} />
          </span>
          <span>
            {isAr
              ? 'المقر الرئيسي: دبي، الإمارات العربية المتحدة · هاتف: '
              : 'Head office: Dubai, United Arab Emirates · Tel: '}
          </span>
          <bdi dir="ltr">+971 4 555 0123</bdi>
        </div>
      </section>

      <section
        className="login-side"
        style={contentPaddingTop ? { paddingTop: contentPaddingTop } : undefined}
      >
        <div className="login-side-aura" aria-hidden="true" />
        <div className="login-side-top" style={{ top: toggleTop }}>
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
              <div
                className="maintenance-login-banner"
                role="alert"
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.05))',
                  border: '1.5px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '12px',
                  padding: '0.9rem 1rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.08)',
                  textAlign: isAr ? 'right' : 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={19} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <strong
                      style={{
                        color: '#dc2626',
                        fontSize: '0.92rem',
                        display: 'block',
                        fontWeight: 700,
                      }}
                    >
                      {isAr
                        ? 'النظام في وضع الصيانة والتوقف المؤقت'
                        : 'System Currently Under Maintenance'}
                    </strong>
                    <small style={{ color: '#64748b', fontSize: '0.74rem' }}>
                      {isAr
                        ? 'إجراء رقابي معتمد من إدارة المنصة'
                        : 'Authorized platform maintenance mode'}
                    </small>
                  </div>
                </div>

                {/* Custom message if provided */}
                {(lockdown.message_ar || lockdown.message_en) && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      color: '#0f172a',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      lineHeight: '1.5',
                    }}
                  >
                    <span
                      style={{
                        color: '#ef4444',
                        marginRight: isAr ? 0 : '0.4rem',
                        marginLeft: isAr ? '0.4rem' : 0,
                      }}
                    >
                      📢
                    </span>
                    {isAr
                      ? (lockdown.message_ar || lockdown.message_en)
                      : (lockdown.message_en || lockdown.message_ar)}
                  </div>
                )}
              </div>
            )}

            <LoginForm />

            <div className="login-card-foot">
              <LockKeyhole size={14} aria-hidden="true" />
              <span>{m.loginDisclaimer}</span>
            </div>
          </div>
          <DeveloperCredit as="footer" className="login-footer" />
        </div>
      </section>
    </div>
  );
}
