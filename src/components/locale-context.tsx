'use client';
import { createContext, useContext } from 'react';
import type { Locale, Messages } from '@/lib/i18n';
const Ctx = createContext<{ locale: Locale; m: Messages } | null>(null);
export function LocaleProvider({ locale, m, children }: { locale: Locale; m: Messages; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, m }}>{children}</Ctx.Provider>;
}
export function useLocale() {
  const c = useContext(Ctx);
  if (!c) throw new Error('LocaleProvider missing');
  return c;
}
