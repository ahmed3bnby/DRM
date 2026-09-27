import Link from 'next/link';
import { Compass, ArrowRight } from 'lucide-react';
import { getMessages } from '@/lib/i18n';
import { DeveloperCredit } from '@/components/developer-credit';

export default async function NotFound() {
  const m = await getMessages();
  return <main className="standalone-state">
    <div className="standalone-brand"><img className="standalone-logo" src="/drm-logo.png" alt="DRM - Diligence Risk Management"/><small>{m.brandTagline}</small></div>
    <div className="standalone-card">
      <span className="standalone-icon"><Compass size={30}/></span>
      <h1>{m.nfTitle}</h1>
      <p>{m.nfBody}</p>
      <Link className="button primary" href="/"><ArrowRight size={17}/>{m.nfHome}</Link>
    </div>
    <DeveloperCredit
      as="footer"
      className="standalone-footer"
      style={{ marginTop: '28px', fontSize: '12px', color: '#688274' }}
    />
  </main>;
}
