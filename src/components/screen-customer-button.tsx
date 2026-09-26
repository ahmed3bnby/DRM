'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ScanSearch } from 'lucide-react';
import { screenCustomerAction } from '@/app/actions';

function Submit({
  label,
  pendingLabel,
  isOptimistic
}: {
  label: string;
  pendingLabel: string;
  isOptimistic: boolean;
}) {
  const { pending } = useFormStatus();
  const active = pending || isOptimistic;

  return (
    <button
      type="submit"
      className={`button primary screen-submit${active ? ' is-scanning' : ''}`}
      disabled={active}
      aria-live="polite"
    >
      <ScanSearch size={17} className={active ? 'radar-spin' : ''} aria-hidden />
      <span>{active ? pendingLabel : label}</span>
    </button>
  );
}

export default function ScreenCustomerButton({
  customerId,
  reference,
  label,
  pendingLabel
}: {
  customerId: string;
  reference?: string;
  label: string;
  pendingLabel: string;
}) {
  const [clicked, setClicked] = useState(false);

  return (
    <form
      action={screenCustomerAction}
      className="screen-form"
      onSubmit={() => setClicked(true)}
    >
      <input type="hidden" name="customerId" value={customerId} />
      {reference && <input type="hidden" name="reference" value={reference} />}
      <Submit label={label} pendingLabel={pendingLabel} isOptimistic={clicked} />
    </form>
  );
}

