import Link from 'next/link';
import { FileSearch, ArrowRight } from 'lucide-react';
import { getMessages } from '@/lib/i18n';

export default async function ProfileNotFound() {
  const m = await getMessages();
  return <section className="profile-state panel">
    <span className="profile-state-icon"><FileSearch size={29}/></span>
    <div>
      <h1>{m.profileNotFoundTitle}</h1>
      <p>{m.profileNotFoundBody}</p>
      <Link className="button primary" href="/profiles"><ArrowRight size={17}/>{m.profileBackRegistry}</Link>
    </div>
  </section>;
}
