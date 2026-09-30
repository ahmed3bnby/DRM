'use client';

import React, { useTransition, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { triggerMonitoringCycleAction } from '@/app/actions';

export default function RunMonitoringButton({
  isArabic = true
}: {
  isArabic?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    scannedCount: number;
    newAlertsCount: number;
  } | null>(null);

  const handleRun = () => {
    startTransition(async () => {
      try {
        const res = await triggerMonitoringCycleAction();
        setResult(res);
        setTimeout(() => setResult(null), 6000);
      } catch (err) {
        console.error('Failed to trigger monitoring cycle:', err);
      }
    });
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {result && (
        <span
          style={{
            fontSize: '11px',
            color: result.newAlertsCount > 0 ? '#b91c1c' : '#15803d',
            background: result.newAlertsCount > 0 ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${result.newAlertsCount > 0 ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '6px',
            padding: '4px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {result.newAlertsCount > 0 ? (
            <AlertCircle size={13} />
          ) : (
            <CheckCircle2 size={13} />
          )}
          {isArabic
            ? `تم فحص ${result.scannedCount} عميل (${result.newAlertsCount} تنبيه جديد)`
            : `Scanned ${result.scannedCount} customers (${result.newAlertsCount} new alerts)`}
        </span>
      )}
      <button
        type="button"
        onClick={handleRun}
        disabled={isPending}
        className="button secondary sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '38px',
          minHeight: '38px',
          padding: '0 12px',
          fontSize: '12px',
          fontWeight: 500,
          borderRadius: '7px',
          whiteSpace: 'nowrap',
          cursor: isPending ? 'wait' : 'pointer'
        }}
        title={
          isArabic
            ? 'تشغيل فحص دوري فوري لكافة العملاء الخاضعين للمراقبة'
            : 'Execute immediate monitoring cycle for all monitored customers'
        }
      >
        <RefreshCw size={14} className={isPending ? 'spin' : ''} />
        <span>
          {isPending
            ? isArabic
              ? 'جاري الفحص المستمر...'
              : 'Scanning customers...'
            : isArabic
            ? 'فحص المراقبة المستمرة الآن'
            : 'Run Monitoring Cycle'}
        </span>
      </button>
    </div>
  );
}
