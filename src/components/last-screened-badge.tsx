'use client';

import { CheckCheck, Clock, ShieldCheck } from 'lucide-react';
import type { Locale } from '@/lib/i18n';

export function formatWhatsAppStyleLastSeen(dateInput: Date | string, locale: Locale = 'ar'): {
  headline: string;
  relative: string;
  exact: string;
} {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return {
      headline: locale === 'en' ? 'Not screened yet' : 'لم يُفحص بعد',
      relative: '',
      exact: '',
    };
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isEn = locale === 'en';

  const timeStr = d.toLocaleTimeString(isEn ? 'en-US' : 'ar-AE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const fullDateStr = d.toLocaleDateString(isEn ? 'en-GB' : 'ar-AE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Check if today / yesterday
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  let relative = '';
  if (diffMin < 1) {
    relative = isEn ? 'Just now' : 'الآن';
  } else if (diffMin < 60) {
    relative = isEn
      ? `${diffMin}m ago`
      : `منذ ${diffMin} ${diffMin === 1 ? 'دقيقة' : diffMin === 2 ? 'دقيقتين' : diffMin <= 10 ? 'دقائق' : 'دقيقة'}`;
  } else if (diffHours < 24 && isToday) {
    relative = isEn
      ? `${diffHours}h ago`
      : `منذ ${diffHours} ${diffHours === 1 ? 'ساعة' : diffHours === 2 ? 'ساعتين' : diffHours <= 10 ? 'ساعات' : 'ساعة'}`;
  } else if (diffDays === 1 || isYesterday) {
    relative = isEn ? 'Yesterday' : 'أمس';
  } else if (diffDays < 7) {
    relative = isEn ? `${diffDays}d ago` : `منذ ${diffDays} أيام`;
  } else {
    relative = fullDateStr;
  }

  let headline = '';
  if (isToday) {
    headline = isEn ? `Today at ${timeStr}` : `اليوم في ${timeStr}`;
  } else if (isYesterday) {
    headline = isEn ? `Yesterday at ${timeStr}` : `أمس في ${timeStr}`;
  } else if (diffDays < 7) {
    const weekday = d.toLocaleDateString(isEn ? 'en-US' : 'ar-AE', { weekday: 'long' });
    headline = isEn ? `${weekday} at ${timeStr}` : `يوم ${weekday} في ${timeStr}`;
  } else {
    headline = isEn ? `${fullDateStr} at ${timeStr}` : `${fullDateStr} في ${timeStr}`;
  }

  return {
    headline,
    relative,
    exact: `${fullDateStr} · ${timeStr}`,
  };
}

export function LastScreenedBadge({
  date,
  locale = 'ar',
  variant = 'header',
}: {
  date: Date | string | null | undefined;
  locale?: Locale;
  variant?: 'header' | 'side-card' | 'inline';
}) {
  if (!date) return null;

  const { headline, relative, exact } = formatWhatsAppStyleLastSeen(date, locale);
  const isEn = locale === 'en';

  if (variant === 'header') {
    return (
      <div
        className="whatsapp-last-seen-badge"
        title={exact}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          background: 'rgba(22, 163, 74, 0.08)',
          border: '1px solid rgba(22, 163, 74, 0.22)',
          color: '#15803d',
          padding: '5px 12px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 600,
          lineHeight: 1.2,
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '14px',
            height: '14px',
            color: '#16a34a',
          }}
        >
          <CheckCheck size={16} strokeWidth={2.4} />
        </span>

        <span>
          <span style={{ color: '#4b5563', fontWeight: 500 }}>
            {isEn ? 'Last screened: ' : 'آخر فحص: '}
          </span>
          <strong>{headline}</strong>
          {relative && !headline.includes(relative) && (
            <span style={{ color: '#16a34a', marginInlineStart: '6px', fontSize: '11px', fontWeight: 500 }}>
              ({relative})
            </span>
          )}
        </span>
      </div>
    );
  }

  if (variant === 'side-card') {
    return (
      <div
        className="side-last-screened-box"
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 14px',
          margin: '12px 0 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <CheckCheck size={15} style={{ color: '#16a34a' }} />
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            {isEn ? 'Watchlist Verification (Last Seen)' : 'توقيت آخر فحص تحققي رسمي:'}
          </span>
        </div>
        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
          {headline}
        </strong>
        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 500, display: 'block', marginTop: '2px' }}>
          {relative ? `(${relative}) · ` : ''}
          {isEn ? 'All watchlists verified' : 'فُحصت كافة القوائم المعتمدة'}
        </span>
      </div>
    );
  }

  // default inline
  return (
    <span className="last-seen-inline" title={exact} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#16a34a' }}>
      <CheckCheck size={14} />
      <span>{isEn ? 'Last screened: ' : 'آخر فحص: '} <strong>{headline}</strong> ({relative})</span>
    </span>
  );
}
