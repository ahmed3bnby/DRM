import Link from 'next/link';
import {isPlatformOwner} from '@/lib/platform-access';
import {hasFeature} from '@/lib/features';
import { LogOut, AlertTriangle, Power } from 'lucide-react';
import Navigation from './navigation';
import SidebarShell from './sidebar-shell';
import LanguageToggle from './language-toggle';
import type { Actor } from '@/lib/auth';
import { logoutAction, quickReenableSystemAction } from '@/app/actions';
import { getMessages, getLocale } from '@/lib/i18n';
import { getSystemLockdown } from '@/lib/platform';
import { DeveloperCredit } from './developer-credit';

export default async function Shell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const isOwner = isPlatformOwner(actor);
  const [m, locale, lockdown] = await Promise.all([
    getMessages(),
    getLocale(),
    isOwner ? getSystemLockdown() : Promise.resolve({ enabled: false })
  ]);
  return <div className="app-shell">
    <a href="#main" className="skip-link">{m.skip}</a>
    <SidebarShell closeLabel={m.sidebarClose} openLabel={m.sidebarOpen}>
      <div className="sidebar-head">
        <Link href="/" className="brand" title="DRM - Diligence Risk Management">
          <span className="brand-symbol"><img src="/drm-logo.png" alt="DRM - Diligence Risk Management" width={48} height={22}/></span>
          <span className="brand-text">
            <small>{m.brandTagline}</small>
          </span>
        </Link>
        <div className="sidebar-head-tools">
          <span className="avatar avatar-mobile" title={actor.displayName}>{actor.displayName[0]}</span>
          <LanguageToggle/>
          <form action={logoutAction}><button className="logout" aria-label={m.logout} title={m.logout}><LogOut size={18}/></button></form>
        </div>
      </div>
      <Navigation isAdmin={actor.role === 'admin'} isOwner={isPlatformOwner(actor)} reviews={hasFeature(actor,'reviews')}/>

      <div className="sidebar-bottom">
        <span className={`avatar ${isPlatformOwner(actor) ? 'avatar-superadmin' : ''}`} title={actor.displayName}>{actor.displayName[0]}</span>
        <span className="user-meta"><strong>{actor.displayName}</strong><small>{isPlatformOwner(actor) ? (locale === 'en' ? '👑 Super Admin' : '👑 سوبر أدمن') : actor.role === 'admin' ? m.roleAdminOpt : actor.role === 'analyst' ? m.roleAnalystOpt : m.roleViewerOpt}</small></span>
        <div className="sidebar-bottom-actions">
          <LanguageToggle/>
          <form action={logoutAction}><button className="logout" aria-label={m.logout} title={m.logout}><LogOut size={18}/></button></form>
        </div>
      </div>
    </SidebarShell>
    <div className="app-body">
      {isOwner && lockdown.enabled && (
        <aside className="superadmin-lockdown-banner" role="alert">
          <div className="lockdown-banner-text">
            <AlertTriangle size={17} />
            <span>
              {locale === 'en'
                ? 'System Lockdown Active: The platform is currently disabled for regular users. Only Super Admin has access.'
                : 'وضع الصيانة نشط: النظام معطّل حالياً أمام كافة المستخدمين والمؤسسات، ولا يمكن لأحد الدخول سواك.'}
            </span>
          </div>
          <form action={quickReenableSystemAction}>
            <button
              type="submit"
              className="button primary"
              style={{
                background: 'var(--success, #10b981)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Power size={13} />
              <span>{locale === 'en' ? 'Re-enable System Now' : 'تشغيل النظام الآن'}</span>
            </button>
          </form>
        </aside>
      )}
      <main id="main" className="main">{children}</main>
      <footer className="footer">
        <span><a href="https://drmuae.com/" target="_blank" rel="noopener noreferrer" dir="ltr" translate="no" className="footer-brand-link">DRM</a> · {m.footerName}</span>
        <DeveloperCredit className="footer-developer" />
        <span>{m.footerData}</span>
      </footer>
    </div>
  </div>;
}
