'use client';
import { useRouter } from 'next/navigation';
import { useLocale } from './locale-context';

export default function LanguageToggle() {
  const { locale } = useLocale();
  const router = useRouter();
  const toggle = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  };
  return (
    <button
      type="button"
      className="locale-toggle"
      onClick={toggle}
      aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      title={locale === 'ar' ? 'English' : 'العربية'}
    >
      <span className="locale-flag" aria-hidden>{locale === 'ar' ? '🇺🇸' : '🇦🇪'}</span>
      <span className="locale-name">{locale === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  );
}
