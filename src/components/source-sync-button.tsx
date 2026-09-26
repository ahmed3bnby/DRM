'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Clock, CalendarClock } from 'lucide-react';
import { startSync } from '@/app/(workspace)/admin/actions';
import { useToast } from '@/components/toast';

type SourceSyncButtonProps = {
  lastSyncDate?: string | null;
  isRunning?: boolean;
  locale: string;
  isAdmin: boolean;
  nextScheduledDate?: string | null;
  scheduleEnabled?: boolean;
};

export default function SourceSyncButton({
  lastSyncDate,
  isRunning = false,
  locale,
  isAdmin,
  nextScheduledDate,
  scheduleEnabled = true,
}: SourceSyncButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [syncRequested, setSyncRequested] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const isSyncing = isRunning || isPending || syncRequested;

  // Poll while syncing
  useEffect(() => {
    if (!isSyncing) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [isSyncing, router]);

  // Live timer tick every 30s to update countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Format last sync date
  const formatTime = (iso?: string | null) => {
    if (!iso) return locale === 'en' ? 'Not recorded' : 'غير مسجل';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(locale === 'en' ? 'en-GB' : 'ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai',
    });
  };

  // Format time remaining until next automatic scheduled sync
  const formatCountdown = (iso?: string | null) => {
    if (!scheduleEnabled) {
      return locale === 'en' ? 'Automation paused' : 'التحديث التلقائي معطّل';
    }
    if (!iso) {
      return locale === 'en' ? 'Scheduled daily' : 'مجدول دورياً';
    }
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) return '—';
    const diff = target - nowMs;

    if (diff <= 0) {
      return locale === 'en' ? 'Starting shortly' : 'وشيك (خلال دقائق)';
    }

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return locale === 'en'
        ? `in ${days}d ${remHours}h`
        : `خلال ${days} يوم و ${remHours} ساعة`;
    }

    if (hours > 0) {
      return locale === 'en'
        ? `in ${hours}h ${minutes}m`
        : `خلال ${hours} ساعة و ${minutes} دقيقة`;
    }

    return locale === 'en'
      ? `in ${minutes} mins`
      : `خلال ${minutes} دقيقة`;
  };

  const formatClockTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai',
    });
  };

  const handleSync = () => {
    if (isSyncing) return;
    setSyncRequested(true);
    startTransition(async () => {
      try {
        const res = await startSync();
        if (res.ok) {
          toast(
            locale === 'en'
              ? 'Source synchronization started in the background.'
              : 'تم بدء مزامنة وتحديث المصادر في الخلفية بنجاح.',
            'success'
          );
        } else if (res.error === 'serverless') {
          toast(
            locale === 'en'
              ? 'Live manual sync is restricted on serverless hosting. Scheduled background sync is active.'
              : 'التحديث التلقائي المجدول نشط عبر السيرفر؛ التحديث اليدوي الفوري يتطلب بيئة تشغيل محلية.',
            'error'
          );
        } else if (res.error === 'busy') {
          toast(
            locale === 'en' ? 'Sync is already running.' : 'عملية المزامنة قيد التشغيل بالفعل.',
            'error'
          );
        }
      } catch (e) {
        toast(
          locale === 'en' ? 'Failed to trigger sync.' : 'تعذر بدء عملية التحديث.',
          'error'
        );
      } finally {
        setTimeout(() => setSyncRequested(false), 4000);
        router.refresh();
      }
    });
  };

  return (
    <div className="source-sync-widget">
      {isAdmin ? (
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className={`source-sync-action-btn ${isSyncing ? 'running' : ''}`}
          title={locale === 'en' ? 'Check & sync lists from official sources' : 'فحص وتحديث القوائم من المصادر الرسمية'}
        >
          <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
          <span>
            {isSyncing
              ? (locale === 'en' ? 'Updating sources…' : 'جارٍ تحديث المصادر…')
              : (locale === 'en' ? 'Sync sources now' : 'تحديث المصادر الآن')}
          </span>
        </button>
      ) : (
        <span className="source-sync-badge">
          <RefreshCw size={15} />
          <span>{locale === 'en' ? 'Live tracked sources' : 'مصادر قيد المتابعة'}</span>
        </span>
      )}

      <div className="source-sync-meta-stack">
        <div className="source-sync-meta-box">
          <span className="source-sync-meta-label">
            <Clock size={12} />
            {locale === 'en' ? 'Last update:' : 'آخر تحديث كان:'}
          </span>
          <strong className="source-sync-meta-time" dir="auto">
            {formatTime(lastSyncDate)}
          </strong>
        </div>

        <div className="source-sync-meta-box auto-sync">
          <span className="source-sync-meta-label">
            <CalendarClock size={12} />
            {locale === 'en' ? 'Next auto-sync:' : 'التحديث التلقائي القادم:'}
          </span>
          <strong className="source-sync-meta-time text-emerald" dir="auto">
            {formatCountdown(nextScheduledDate)}
            {nextScheduledDate && scheduleEnabled && (
              <span className="source-sync-clock-note">
                {' '}({formatClockTime(nextScheduledDate)})
              </span>
            )}
          </strong>
        </div>
      </div>
    </div>
  );
}
