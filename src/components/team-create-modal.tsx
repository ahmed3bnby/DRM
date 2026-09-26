'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { UserPlus, LoaderCircle, X } from 'lucide-react';
import { createUserAction, type FormState } from '@/app/actions';
import { useLocale } from '@/components/locale-context';
import { useToast } from '@/components/toast';
export default function TeamCreateModal() {
  const { m } = useLocale();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(createUserAction, {} as FormState);
  const error = (name: string) => state.fields?.[name]?.[0];
  const v = (name: string) => state.values?.[name] ?? '';
  const wasPending = useRef(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const requestClose = () => {
    if (dirty && !window.confirm(m.teamDiscardChanges)) return;
    setDirty(false); setOpen(false);
  };
  // Close + toast only after a submit that returned no errors (success revalidates the list on the server).
  useEffect(() => { if (wasPending.current && !pending && !state.error && !state.fields) { setDirty(false); setOpen(false); toast(m.teamSaved, 'success'); } wasPending.current = pending; }, [pending, state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open && wasOpen.current) openerRef.current?.focus(); wasOpen.current = open; }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const items = [...focusable]; const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, dirty]);
  return <>
    <button ref={openerRef} type="button" className="button primary" onClick={() => { setDirty(false); setOpen(true); }}><UserPlus size={18}/>{m.teamNewTitle}</button>
    {open && <div className="modal-overlay" onClick={requestClose}>
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-label={m.teamNewTitle} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h2>{m.teamNewTitle}</h2><p>{m.teamNewHint}</p></div><button type="button" className="modal-close" aria-label={m.cancel} onClick={requestClose}><X size={18}/></button></div>
        <form action={action} className="modal-body" onInput={() => setDirty(true)} onChange={() => setDirty(true)}>
          {state.error && <div role="alert" className="form-error">{state.error}</div>}
          <div className="form-grid">
            <div className="field"><label htmlFor="displayName">{m.teamFName} <em>*</em></label><input id="displayName" name="displayName" autoFocus required minLength={2} maxLength={80} defaultValue={v('displayName')} aria-invalid={!!error('displayName')}/>{error('displayName') && <small className="field-error">{error('displayName')}</small>}</div>
            <div className="field"><label htmlFor="email">{m.teamFEmail} <em>*</em></label><input type="email" id="email" name="email" dir="ltr" spellCheck={false} placeholder="name@example.com" required defaultValue={v('email')} aria-invalid={!!error('email')}/>{error('email') && <small className="field-error">{error('email')}</small>}</div>
            <div className="field"><label htmlFor="role">{m.teamFRole} <em>*</em></label><select id="role" name="role" defaultValue={v('role') || 'viewer'}><option value="viewer">{m.roleViewerOpt}</option><option value="analyst">{m.roleAnalystOpt}</option><option value="admin">{m.roleAdminOpt}</option></select></div>
            <div className="field"><label htmlFor="quota">{m.teamFQuota} <span>{m.teamFQuotaHint}</span></label><input type="number" id="quota" name="quota" dir="ltr" min={0} max={1000000} defaultValue={v('quota') || '50'} aria-invalid={!!error('quota')}/>{error('quota') && <small className="field-error">{error('quota')}</small>}</div>
            <div className="field full"><label htmlFor="password">{m.teamFPassword} <em>*</em> <span>{m.teamFPasswordHint}</span></label><input type="password" id="password" name="password" dir="ltr" minLength={12} maxLength={200} required autoComplete="new-password" aria-invalid={!!error('password')}/>{error('password') && <small className="field-error">{error('password')}</small>}</div>
          </div>
          <div className="form-actions"><button disabled={pending} className="button primary">{pending ? <LoaderCircle className="spin" size={18}/> : <UserPlus size={18}/>} {pending ? m.teamCreating : m.teamCreate}</button><button type="button" className="button secondary" onClick={requestClose}>{m.cancel}</button></div>
        </form>
      </div>
    </div>}
  </>;
}
