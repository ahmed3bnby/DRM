import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';
import { getLocale, getMessages, dirOf } from '@/lib/i18n';
import { LocaleProvider } from '@/components/locale-context';
import { ToastProvider } from '@/components/toast';
import { DeveloperIntegrityGuard } from '@/components/developer-credit';
export const metadata: Metadata = {
  title: 'DRM | Diligence Risk Management',
  description: 'Diligence Risk Management · Risk Management & Pro Services | Customer profiles & compliance reviews',
  robots: { index: false, follow: false }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0e291e' };
export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = await getLocale(); const m = await getMessages();
  return <html lang={locale} dir={dirOf(locale)}><body><LocaleProvider locale={locale} m={m}><ToastProvider>{children}<DeveloperIntegrityGuard /></ToastProvider></LocaleProvider></body></html>;
}
