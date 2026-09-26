'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { useLocale } from '@/components/locale-context';

export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m } = useLocale();
  return <section className="profile-state panel" role="alert">
    <span className="profile-state-icon warning"><AlertTriangle size={29}/></span>
    <div>
      <h1>{m.profileLoadErrorTitle}</h1>
      <p>{m.profileLoadErrorBody}</p>
      <div className="profile-state-actions"><button className="button primary" onClick={reset}><RefreshCw size={17}/>{m.profileRetry}</button><Link className="button secondary" href="/profiles"><ArrowRight size={17}/>{m.profileBackRegistry}</Link></div>
    </div>
  </section>;
}
