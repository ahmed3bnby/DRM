'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UsersRound, Database, Search, UserCog, ClipboardCheck, Activity, MoreHorizontal, Building2, BarChart3 } from 'lucide-react';
import { useLocale } from './locale-context';

type NavigationItem = { href: string; label: string; short: string; icon: typeof LayoutDashboard };

export default function Navigation({ isAdmin = false, isOwner = false, reviews = false }: { isAdmin?: boolean; isOwner?: boolean; reviews?: boolean }) {
  const path = usePathname();
  const { m, locale } = useLocale();
  const isEn = locale === 'en';
  const groups: { label: string; items: NavigationItem[] }[] = [
    { label: m.navGroupWorkspace, items: [
      { href: '/', label: m.navOverview, short: m.navOverviewShort, icon: LayoutDashboard },
      { href: '/search', label: m.navSearch, short: m.navSearchShort, icon: Search },
    ] },
    { label: m.navGroupCompliance, items: [
      { href: '/profiles', label: m.navCustomers, short: m.navCustomersShort, icon: UsersRound },
      { href: '/analytics', label: isEn ? 'Executive Analytics' : 'لوحة المؤشرات والتحليلات', short: isEn ? 'Analytics' : 'التحليلات', icon: BarChart3 },
      ...(reviews ? [{ href: '/reviews', label: m.navReviews, short: m.navReviewsShort, icon: ClipboardCheck }] : []),
    ] },
    ...(isAdmin ? [{ label: m.navGroupAdministration, items: [
      { href: '/sources', label: m.navSources, short: m.navSourcesShort, icon: Database },
      { href: '/team', label: m.navTeam, short: m.navTeamShort, icon: UserCog },
      ...(isOwner ? [{ href: '/admin', label: m.opNav, short: m.opNavShort, icon: Activity }] : []),
      ...(isOwner ? [{ href: '/platform', label: m.platformNav, short: m.platformNavShort, icon: Building2 }] : []),
    ] }] : []),
  ];
  const mobileOverflow = [
    ...(isOwner ? [{ href: '/admin', label: m.opNav, icon: Activity }] : []),
    ...(isOwner ? [{ href: '/platform', label: m.platformNav, icon: Building2 }] : []),
    ...(isAdmin ? [{ href: '/sources', label: m.navSources, icon: Database }, { href: '/team', label: m.navTeam, icon: UserCog }] : []),
  ];

  return <nav className="app-nav app-nav-grouped" aria-label={m.navSection}>{groups.map(group => <section className="nav-group" key={group.label}>
    <div className="nav-group-label">{group.label}</div>
    {group.items.map(({href,label,short,icon:Icon}) => {
      const active = href === '/' ? path === '/' : path.startsWith(href);
      return <Link key={href} href={href} className={`nav-link ${active?'active':''}`} aria-current={active?'page':undefined} aria-label={label} title={label}>
        <Icon size={19} aria-hidden="true"/><span className="nav-text-full">{label}</span><span className="nav-text-short">{short}</span>
      </Link>;
    })}
  </section>)}{mobileOverflow.length > 0 && <details className="nav-more"><summary aria-label={m.navMore} title={m.navMore}><MoreHorizontal size={20} aria-hidden="true"/><span className="nav-text-short">{m.navMore}</span></summary><div>{mobileOverflow.map(({href,label,icon:Icon}) => <Link key={href} href={href} className={path.startsWith(href) ? 'active' : ''}><Icon size={18} aria-hidden="true"/><span>{label}</span></Link>)}</div></details>}</nav>;
}
