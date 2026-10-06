'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { useLocale } from '@/components/locale-context';

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m } = useLocale();
  return <main className="standalone-state" role="alert">
    <div className="standalone-brand"><span className="standalone-logo brand-wordmark">ABC</span><small>{m.brandTagline}</small></div>
    <div className="standalone-card">
      <span className="standalone-icon warning"><AlertTriangle size={30}/></span>
      <h1>{m.errTitle}</h1>
      <p>{m.errBody}</p>
      <div className="standalone-actions">
        <button className="button primary" onClick={reset}><RefreshCw size={17}/>{m.errRetry}</button>
        <Link className="button secondary" href="/"><ArrowRight size={17}/>{m.errHome}</Link>
      </div>
    </div>
  </main>;
}
