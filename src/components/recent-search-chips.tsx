'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Loader2 } from 'lucide-react';

// Recent-search chips navigate via a transition so the clicked chip shows a
// spinner (and the rest are disabled) while the results load — matching the
// pending feedback the main SearchForm already gives.
export default function RecentSearchChips({ items }: { items: { query: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<number | null>(null);

  const go = (idx: number, query: string) => {
    if (isPending) return;
    setActive(idx);
    startTransition(() => router.push(`/search?q=${encodeURIComponent(query)}`));
  };

  return (
    <div className={`recent-searches-chips ${isPending ? 'is-navigating' : ''}`}>
      {items.map((item, idx) => (
        <button
          key={item.query + idx}
          type="button"
          className={`recent-search-chip ${isPending && active === idx ? 'is-loading' : ''}`}
          onClick={() => go(idx, item.query)}
          disabled={isPending}
        >
          {isPending && active === idx
            ? <Loader2 size={12} className="radar-spin" aria-hidden />
            : <Clock size={12} aria-hidden />}
          <span dir="auto">{item.query}</span>
        </button>
      ))}
    </div>
  );
}
