'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CircleCheck, CircleAlert, X } from 'lucide-react';
type ToastType = 'success' | 'error';
type Toast = { id: number; message: string; type: ToastType };
const Ctx = createContext<(message: string, type?: ToastType) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const remove = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);
  return <Ctx.Provider value={push}>
    {children}
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>
        {t.type === 'success' ? <CircleCheck size={18}/> : <CircleAlert size={18}/>}
        <span>{t.message}</span>
        <button type="button" className="toast-x" onClick={() => remove(t.id)} aria-label="close"><X size={15}/></button>
      </div>)}
    </div>
  </Ctx.Provider>;
}
export function useToast() { return useContext(Ctx); }
