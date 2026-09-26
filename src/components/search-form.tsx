'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ScanSearch, X } from 'lucide-react';

type SearchFormProps = {
  defaultValue?: string;
  placeholder: string;
  inputAria: string;
  btnText: string;
  scanningText: string;
};

export default function SearchForm({
  defaultValue = '',
  placeholder,
  inputAria,
  btnText,
  scanningText,
}: SearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    });
  };

  return (
    <form className={`search-form ${isPending ? 'is-searching' : ''}`} onSubmit={handleSubmit} role="search">
      <div className="search-field-wrap">
        <label className="sr-only" htmlFor="search-query">{inputAria}</label>
        <Search size={18} className="search-field-icon" aria-hidden />
        <input
          id="search-query"
          name="q"
          value={query}
          onChange={e => setQuery(e.target.value)}
          minLength={3}
          maxLength={160}
          required
          placeholder={placeholder}
          dir="auto"
          autoComplete="off"
          disabled={isPending}
        />
        {query && !isPending && (
          <button
            type="button"
            className="clear-query-btn"
            onClick={() => setQuery('')}
            aria-label="Clear"
          >
            <X size={15} />
          </button>
        )}
        {isPending && <div className="search-scan-beam" aria-hidden="true" />}
      </div>
      <button
        type="submit"
        className={`button primary search-submit-btn ${isPending ? 'is-scanning' : ''}`}
        disabled={isPending || query.trim().length < 3}
        aria-live="polite"
      >
        {isPending ? (
          <>
            <ScanSearch size={18} className="radar-spin" aria-hidden />
            <span>{scanningText}</span>
          </>
        ) : (
          <>
            <Search size={18} aria-hidden />
            <span>{btnText}</span>
          </>
        )}
      </button>
    </form>
  );
}
