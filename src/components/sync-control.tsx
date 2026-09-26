'use client';

import { useState, useEffect, useTransition, useId } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Play, AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck, Clock } from 'lucide-react';
import type { SyncRun } from '@/lib/operations';
import { startSync } from '@/app/(workspace)/admin/actions';

type SyncControlProps = {
  runningRun?: SyncRun | null;
  latestRun?: SyncRun | null;
  locale: string;
  labels: {
    startSync: string;
    running: string;
    retry: string;
    failedTitle: string;
    failedNotice: string;
    interruptedTitle: string;
    interruptedNotice: string;
    safetyGuarantee: string;
    successTitle: string;
    recordsImported: string;
    exitCode: string;
    elapsed: string;
  };
};

export default function SyncControl({
  runningRun,
  latestRun,
  locale,
  labels,
}: SyncControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [syncRequestedLocal, setSyncRequestedLocal] = useState<boolean>(false);

  const isSyncing = !!runningRun || isPending || syncRequestedLocal;

  // Track elapsed seconds while running
  useEffect(() => {
    if (!isSyncing) {
      setElapsedSec(0);
      return;
    }
    const startTime = runningRun?.startedAt ? new Date(runningRun.startedAt).getTime() : Date.now();
    const updateElapsed = () => {
      const now = Date.now();
      const sec = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSec(sec);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isSyncing, runningRun?.startedAt]);

  // Fast Polling when sync is active (2.5 seconds)
  useEffect(() => {
    if (!isSyncing) return;
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }, 2500);
    return () => clearInterval(pollInterval);
  }, [isSyncing, router]);

  // When a runningRun completes and disappears, reset local syncRequestedLocal
  useEffect(() => {
    if (!runningRun && syncRequestedLocal) {
      setSyncRequestedLocal(false);
    }
  }, [runningRun, syncRequestedLocal]);

  const handleStartSync = () => {
    setSyncRequestedLocal(true);
    startTransition(async () => {
      try {
        await startSync();
      } catch (err) {
        console.error('Failed to trigger sync', err);
        setSyncRequestedLocal(false);
      }
    });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return locale === 'en' ? `${str}s` : `${str} ث`;
  };

  const isFailed = !runningRun && (latestRun?.status === 'failed' || latestRun?.status === 'interrupted');
  const isInterrupted = !runningRun && latestRun?.status === 'interrupted';

  return (
    <div className="sync-control-wrapper">
      {/* 1. Main Action Button & Live Progress */}
      <div className={`sync-hero-card ${isSyncing ? 'is-syncing' : ''}`}>
        <button
          type="button"
          onClick={handleStartSync}
          disabled={isSyncing}
          className={`button primary sync-action-btn ${isSyncing ? 'sync-active' : ''}`}
        >
          <RefreshCw
            size={17}
            className={`sync-icon ${isSyncing ? 'spin-animated' : ''}`}
          />
          <span>{isSyncing ? labels.running : labels.startSync}</span>
          {isSyncing && (
            <span className="sync-timer-badge" dir="ltr">
              <Clock size={13} />
              <bdi>{formatTimer(elapsedSec)}</bdi>
            </span>
          )}
        </button>

        {isSyncing && (
          <div className="sync-progress-track" aria-hidden="true">
            <div className="sync-progress-bar-animated" />
          </div>
        )}
      </div>

      {/* 2. Failure & Interruption Alert Card with Instant Retry */}
      {isFailed && (
        <div className="ops-failure-card" role="alert">
          <div className="ops-failure-header">
            <div className="ops-failure-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="ops-failure-text">
              <strong>{isInterrupted ? labels.interruptedTitle : labels.failedTitle}</strong>
              <p>
                {isInterrupted ? labels.interruptedNotice : labels.failedNotice}
                {latestRun?.exitCode !== undefined && (
                  <span className="ops-exit-code" dir="ltr">
                    ({labels.exitCode}: {latestRun.exitCode})
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="ops-failure-safe-notice">
            <ShieldCheck size={16} />
            <span>{labels.safetyGuarantee}</span>
          </div>

          <div className="ops-failure-actions">
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isSyncing}
              className="button secondary retry-btn"
            >
              <RotateCcw size={15} className={isSyncing ? 'spin-animated' : ''} />
              <span>{labels.retry}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
