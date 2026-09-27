'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect, useRef } from 'react';
import { Search, X, LoaderCircle, ArrowDownUp, SlidersHorizontal, SearchCheck } from 'lucide-react';
import { useLocale } from '@/components/locale-context';

// Soft-navigating search: updates the URL without a full page reload, debounced while typing.
export default function ProfileFilters({ q, type, sort, status, screening }: { q: string; type: string; sort: string; status: string; screening: string }) {
  const { m } = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setValue(q); }, [q]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const go = (nextQ: string, nextSort = sort, nextStatus = status, nextScreening = screening) => {
    const params = new URLSearchParams();
    if (nextQ) params.set('q', nextQ);
    if (type) params.set('type', type);
    if (nextSort && nextSort !== 'recent') params.set('sort', nextSort);
    if (nextStatus) params.set('status', nextStatus);
    if (nextScreening) params.set('screening', nextScreening);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/profiles?${qs}` : '/profiles'));
  };
  const onChange = (nextValue: string) => {
    setValue(nextValue);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go(nextValue.trim()), 400);
  };
  const clear = () => { setValue(''); clearTimeout(timer.current); go(''); };
  const reset = () => { setValue(''); clearTimeout(timer.current); startTransition(() => router.push('/profiles')); };

  return <form className="filter-bar registry-filter-bar" onSubmit={event => { event.preventDefault(); clearTimeout(timer.current); go(value.trim()); }}>
    <label className="registry-filter-field registry-search-field">
      <span className="registry-filter-label"><Search size={14}/>{m.searchCustomerAria}</span>
      <span className="search-input">
        <Search size={18}/>
        <input value={value} onChange={event => onChange(event.target.value)} aria-label={m.searchCustomerAria} placeholder={m.listSearchPlaceholder} maxLength={160}/>
        {pending ? <LoaderCircle size={16} className="spin filter-spin"/> : value && <button type="button" className="input-clear" aria-label={m.resetFilters} onClick={clear}><X size={15}/></button>}
      </span>
    </label>
    <div className="registry-filters-group">
      <label className="registry-filter-field registry-sort-field">
        <span className="registry-filter-label"><ArrowDownUp size={14}/>{m.sortBy}</span>
        <select value={sort || 'recent'} onChange={event => go(value.trim(), event.target.value)} aria-label={m.sortBy}>
          <option value="recent">{m.sortNewest}</option>
          <option value="oldest">{m.sortOldest}</option>
          <option value="name">{m.sortNameAsc}</option>
          <option value="name_desc">{m.sortNameDesc}</option>
          <option value="type">{m.sortType}</option>
          <option value="status">{m.sortStatus}</option>
        </select>
      </label>
      <label className="registry-filter-field registry-status-field">
        <span className="registry-filter-label"><SlidersHorizontal size={14}/>{m.filterProfileStatus}</span>
        <select value={status} onChange={event => go(value.trim(), sort, event.target.value)} aria-label={m.filterProfileStatus}>
          <option value="">{m.filterAnyStatus}</option>
          <option value="draft">{m.stDraft}</option>
          <option value="awaiting_information">{m.stAwaiting}</option>
        </select>
      </label>
      <label className="registry-filter-field registry-screening-field">
        <span className="registry-filter-label"><SearchCheck size={14}/>{m.thScreening}</span>
        <select value={screening} onChange={event => go(value.trim(), sort, status, event.target.value)} aria-label={m.thScreening}>
          <option value="">{m.filterAnyScreening}</option>
          <option value="not_run">{m.scNotRun}</option>
          <option value="no_match">{m.scNoMatch}</option>
          <option value="screened">{m.scScreened}</option>
          <option value="potential_match">{m.scPotential}</option>
        </select>
      </label>
    </div>
    {(q || type || (sort && sort !== 'recent') || status || screening) && <button type="button" className="registry-reset" onClick={reset}><X size={15}/>{m.resetFilters}</button>}
  </form>;
}
