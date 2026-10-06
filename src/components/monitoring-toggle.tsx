'use client';

import React, { useState, useTransition } from 'react';
import { ShieldCheck, Shield, Loader2 } from 'lucide-react';
import { toggleCustomerMonitoringAction } from '@/app/actions';

interface MonitoringToggleProps {
  customerId: string;
  handle?: string;
  initialEnabled: boolean;
  status?: 'clear' | 'flagged' | 'pending_review';
  lastMonitoredAt?: string | null;
  hitCount?: number;
  locale?: string;
}

export default function MonitoringToggle({
  customerId,
  handle,
  initialEnabled,
  lastMonitoredAt,
  locale = 'ar'
}: MonitoringToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const isEn = locale === 'en';

  const handleToggle = () => {
    const nextState = !enabled;
    setEnabled(nextState);
    startTransition(async () => {
      const formData = new FormData();
      formData.append('customerId', customerId);
      formData.append('enabled', String(nextState));
      if (handle) formData.append('handle', handle);
      await toggleCustomerMonitoringAction(formData);
    });
  };

  const tooltipText = lastMonitoredAt
    ? isEn
      ? `Continuous Monitoring is active. Last scanned: ${new Date(lastMonitoredAt).toLocaleDateString()}`
      : `المراقبة المستمرة نشطة. آخر فحص آلي: ${new Date(lastMonitoredAt).toLocaleDateString('ar-AE-u-nu-latn')}`
    : isEn
    ? 'Continuous Automated Monitoring'
    : 'المراقبة الآلية المستمرة';

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`button sm ${enabled ? 'monitor-btn-active' : 'secondary'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        minHeight: '38px',
        height: '38px',
        padding: '0 12px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '7px',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...(enabled
          ? {
              background: '#f0fdf4',
              borderColor: '#86efac',
              color: '#15803d',
              boxShadow: 'var(--shadow-xs)'
            }
          : {
              background: '#ffffff',
              borderColor: '#e2e8f0',
              color: '#64748b'
            })
      }}
      title={tooltipText}
    >
      {isPending ? (
        <Loader2 size={15} className="spin" />
      ) : enabled ? (
        <ShieldCheck size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
      ) : (
        <Shield size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
      )}
      <span>
        {isEn
          ? enabled
            ? 'Monitoring: On'
            : 'Monitoring: Off'
          : enabled
          ? 'المراقبة: مفعّلة'
          : 'المراقبة: متوقفة'}
      </span>
    </button>
  );
}
