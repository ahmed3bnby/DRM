'use client';
import { useActionState, useEffect } from 'react';
import { updateQuotaAction, type QuotaState } from '@/app/actions';
import { useToast } from '@/components/toast';
import { useLocale } from '@/components/locale-context';
export default function QuotaForm({ userId, quota }: { userId: string; quota: number | null }) {
  const { m } = useLocale();
  const toast = useToast();
  const [state, action, pending] = useActionState(updateQuotaAction, {} as QuotaState);
  useEffect(() => {
    if (state.ok) toast(m.teamQuotaSaved, 'success');
    else if (state.error) toast(state.error, 'error');
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return <form action={action} className="quota-form">
    <input type="hidden" name="userId" value={userId}/>
    <input type="number" name="quota" dir="ltr" min={0} max={1000000} defaultValue={quota ?? 0} aria-label={m.teamColQuota} title={m.teamFQuotaHint}/>
    <button disabled={pending} className="button secondary sm">{pending ? '…' : m.teamSetQuota}</button>
  </form>;
}
