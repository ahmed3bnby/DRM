import { Lock } from 'lucide-react';
import Link from 'next/link';
import { getMessages } from '@/lib/i18n';

// Shown when an organization opens a premium feature its plan does not include.
export default async function FeatureLocked({ feature }: { feature: string }) {
  const m = await getMessages();
  return <>
    <div className="page-heading"><div><div className="eyebrow">{m.featureLockedTag}</div><h1>{feature}</h1></div></div>
    <div className="panel empty feature-locked">
      <Lock size={30}/>
      <h2>{m.featureLockedTitle}</h2>
      <p>{m.featureLockedBody}</p>
      <Link href="/" className="button secondary">{m.featureLockedBack}</Link>
    </div>
  </>;
}
