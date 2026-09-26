import Link from 'next/link';
import {isPlatformOwner} from '@/lib/platform-access';
import { LogOut } from 'lucide-react';
import Navigation from './navigation';
import SidebarShell from './sidebar-shell';
import LanguageToggle from './language-toggle';
import type { Actor } from '@/lib/auth';
import { logoutAction } from '@/app/actions';
import { getMessages, getLocale } from '@/lib/i18n';

export default async function Shell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const [m, locale] = await Promise.all([getMessages(), getLocale()]);
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
      <Navigation isAdmin={actor.role === 'admin'} isOwner={isPlatformOwner(actor)}/>
      <div className="sidebar-help">
        <span className="sidebar-help-badge">{locale === 'en' ? 'DRM Advisory' : 'استشارات DRM'}</span>
        <strong>{m.helpTitle}</strong>
        <p>{m.helpBody}</p>
        <div className="sidebar-help-meta">
          <span>{locale === 'en' ? 'Deira, Dubai' : 'دبي · ديرة'}</span>
          <a href="tel:+971557610818" dir="ltr">+971 55 761 0818</a>
        </div>
      </div>
      <div className="sidebar-bottom">
        <span className="avatar" title={actor.displayName}>{actor.displayName[0]}</span>
        <span className="user-meta"><strong>{actor.displayName}</strong><small>{actor.role === 'admin' ? m.roleAdminOpt : actor.role === 'analyst' ? m.roleAnalystOpt : m.roleViewerOpt}</small></span>
        <div className="sidebar-bottom-actions">
          <LanguageToggle/>
          <form action={logoutAction}><button className="logout" aria-label={m.logout} title={m.logout}><LogOut size={18}/></button></form>
        </div>
      </div>
    </SidebarShell>
    <div className="app-body">
      <main id="main" className="main">{children}</main>
      <footer className="footer">
        <span><a href="https://drmuae.com/" target="_blank" rel="noopener noreferrer" dir="ltr" translate="no" className="footer-brand-link">DRM</a> · {m.footerName}</span>
        <span className="footer-developer" dir="ltr">
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
        </span>
        <span>{m.footerData}</span>
      </footer>
    </div>
  </div>;
}
