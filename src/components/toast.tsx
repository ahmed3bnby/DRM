'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CircleCheck, CircleAlert, Info, X } from 'lucide-react';
import { useLocale } from './locale-context';
type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; type: ToastType };
const Ctx = createContext<(message: string, type?: ToastType) => void>(() => {});
// Errors stay up longer: the user usually has to act on them.
const DURATION: Record<ToastType, number> = { success: 4000, info: 5000, error: 7000 };
const ICON = { success: CircleCheck, error: CircleAlert, info: Info };
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const remove = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++idRef.current;
    setToasts(t => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => remove(id), DURATION[type]);
  }, [remove]);
  const closeLabel = locale === 'en' ? 'Dismiss notification' : 'إغلاق التنبيه';
  const render = (t: Toast) => {
    const Icon = ICON[t.type];
    return <div key={t.id} className={`toast toast-${t.type}`}>
      <Icon size={18} aria-hidden="true"/>
      <span>{t.message}</span>
      <button type="button" className="toast-x" onClick={() => remove(t.id)} aria-label={closeLabel} title={closeLabel}><X size={15}/></button>
    </div>;
  };
  return <Ctx.Provider value={push}>
    {children}
    <div className="toast-stack">
      {/* Separate live regions: errors interrupt (assertive), confirmations don't */}
      <div role="status" aria-live="polite">{toasts.filter(t => t.type !== 'error').map(render)}</div>
      <div role="alert" aria-live="assertive">{toasts.filter(t => t.type === 'error').map(render)}</div>
    </div>
  </Ctx.Provider>;
}
export function useToast() { return useContext(Ctx); }
