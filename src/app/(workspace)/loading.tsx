import { getLocale } from '@/lib/i18n';

// Shown inside the shell while a workspace page's server data loads, so navigation
// gives instant feedback instead of a frozen screen. Mirrors the common page shape:
// header → metric cards → table.
export default async function WorkspaceLoading() {
  const locale = await getLocale();
  return <div className="page-skeleton" role="status" aria-busy="true" aria-live="polite">
    <span className="sr-only">{locale === 'en' ? 'Loading…' : 'جارٍ التحميل…'}</span>
    <div className="skel-heading" aria-hidden="true">
      <div>
        <span className="skel skel-line" style={{ width: 90 }} />
        <span className="skel skel-title" />
        <span className="skel skel-line" style={{ width: 280 }} />
      </div>
      <span className="skel skel-button" />
    </div>
    <div className="skel-metrics" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="skel-card">
        <span className="skel skel-line" style={{ width: '55%' }} />
        <span className="skel skel-number" />
        <span className="skel skel-line" style={{ width: '40%' }} />
      </div>)}
    </div>
    <div className="skel-panel" aria-hidden="true">
      <div className="skel-panel-head"><span className="skel skel-line" style={{ width: 160, height: 14 }} /></div>
      {Array.from({ length: 6 }, (_, i) => <div key={i} className="skel-row">
        <span className="skel skel-avatar" />
        <span className="skel skel-line" style={{ width: `${30 + ((i * 17) % 25)}%` }} />
        <span className="skel skel-line skel-hide-sm" style={{ width: '12%' }} />
        <span className="skel skel-pill" />
      </div>)}
    </div>
  </div>;
}
