'use client';

import React, { useState, useTransition } from 'react';
import { ShieldCheck, ShieldAlert, Shield, Loader2, Radio } from 'lucide-react';
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
  status = 'clear',
  lastMonitoredAt,
  hitCount = 0,
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

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 12px',
        borderRadius: '8px',
        background: enabled ? '#f0fdf4' : '#f8fafc',
        border: `1px solid ${enabled ? '#bbf7d0' : '#e2e8f0'}`,
        transition: 'all 0.18s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {enabled ? (
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <ShieldCheck size={16} style={{ color: '#007527' }} />
          </span>
        ) : (
          <Shield size={16} style={{ color: '#94a3b8' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: enabled ? '#166534' : '#64748b'
            }}
          >
            {isEn ? 'Ongoing Monitoring' : 'المراقبة المستمرة'}:{' '}
            {enabled ? (isEn ? 'ACTIVE' : 'مفعّلة') : (isEn ? 'OFF' : 'متوقفة')}
          </span>
          {lastMonitoredAt && enabled && (
            <small style={{ fontSize: '9.5px', color: '#65a30d' }}>
              {isEn ? 'Last scanned: ' : 'آخر فحص: '}
              {new Date(lastMonitoredAt).toLocaleDateString(isEn ? 'en-US' : 'ar-AE')}
            </small>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="button secondary sm"
        style={{
          minHeight: '26px',
          padding: '2px 8px',
          fontSize: '10.5px',
          borderRadius: '5px'
        }}
        title={isEn ? 'Toggle Ongoing Monitoring' : 'تفعيل أو تعطيل المراقبة التلقائية'}
      >
        {isPending ? (
          <Loader2 size={12} className="spin" />
        ) : enabled ? (
          (isEn ? 'Disable' : 'تعطيل')
        ) : (
          (isEn ? 'Enable' : 'تفعيل')
        )}
      </button>
    </div>
  );
}
