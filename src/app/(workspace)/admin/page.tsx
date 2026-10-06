import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { isPlatformOwner } from '@/lib/platform-access';
import { operationsData } from '@/lib/operations';
import { getLocale, getMessages } from '@/lib/i18n';
import OperationsRefresh from '@/components/operations-refresh';
import SyncControl from '@/components/sync-control';
import ScheduleConfigControl from '@/components/schedule-config-control';
import { FREQUENCY_DETAILS } from '@/lib/schedule-config';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  ListChecks,
  Play,
  TriangleAlert,
  CalendarClock,
  RefreshCw,
  UserCheck,
  Plus,
  Minus,
  Timer,
  Sliders,
  RotateCcw
} from 'lucide-react';

const statusLabel = (status: string, m: Awaited<ReturnType<typeof getMessages>>) => ({
  running: m.opRunRunning,
  success: m.opRunSuccess,
  failed: m.opRunFailed,
  interrupted: m.opRunInterrupted
}[status] ?? status);

function formatNextRunTime(isoStr: string | undefined, locale: string) {
  if (!isoStr) return locale === 'en' ? 'Disabled / No upcoming run' : 'معطل · لا يوجد موعد تشغيل قادم';
  const d = new Date(isoStr);
  return d.toLocaleString(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai'
  });
}

export default async function Admin({
  searchParams
}: {
  searchParams: Promise<{ sync?: string }>;
}) {
  const actor = await requireActor();
  if (!isPlatformOwner(actor)) notFound();

  const [data, params, m, locale] = await Promise.all([
    operationsData(),
    searchParams,
    getMessages(),
    getLocale()
  ]);

  const time = (s: string | null | undefined) => s
    ? new Date(s).toLocaleString(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Dubai'
      })
    : m.opNoTime;

  const number = (value: number | bigint | string) =>
    Number(value).toLocaleString(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn');

  const formatDuration = (s: string | null, f: string | null) => {
    if (!s || !f) return '—';
    const ms = new Date(f).getTime() - new Date(s).getTime();
    if (ms < 0) return '—';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) {
      return locale === 'en' ? `${totalSec}s` : `${totalSec} ث`;
    }
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return locale === 'en' ? `${mins}m ${secs}s` : `${mins} د ${secs} ث`;
  };

  const running = data.runs.find(r => r.status === 'running');
  const latestManual = data.latestManual;
  const latestScheduled = data.latestScheduled;
  const sourcesNeedingReview = data.sources.filter(s => s.syncStatus?.status === 'failed').length;
  const checkedSources = data.sources.filter(s => s.syncStatus?.status === 'success').length;

  const scheduleStale = latestScheduled?.startedAt
    ? (Date.now() - new Date(latestScheduled.startedAt).getTime()) > 7 * 24 * 60 * 60 * 1000
    : false;
  const schedulerLoaded = data.scheduler.state === 'loaded';
  const exitCodeFailed = schedulerLoaded && !!data.scheduler.exitCode && data.scheduler.exitCode !== '0';
  const schedulerHealthy = schedulerLoaded && !exitCodeFailed && !scheduleStale;

  const schedulerText = data.scheduler.state === 'loaded'
    ? `${m.opScheduleLoaded}${data.scheduler.exitCode ? ` · ${m.opScheduleExit}: ${data.scheduler.exitCode}` : ''} ${m.opScheduleCaveat}`
    : data.scheduler.state === 'not_loaded'
    ? m.opScheduleNotLoaded
    : data.scheduler.state === 'unsupported'
    ? m.opScheduleUnsupported
    : m.opScheduleUnknown;

  const latestAny = data.runs[0];
  const latestFailed = latestAny?.status === 'failed' || latestAny?.status === 'interrupted';
  const overallTone = sourcesNeedingReview || latestFailed || !schedulerHealthy ? 'attention' : 'healthy';

  const syncLabels = {
    startSync: m.opStartSync,
    running: m.opRunning,
    retry: locale === 'en' ? 'Retry Sync Now' : 'إعادة المحاولة الفورية',
    failedTitle: locale === 'en' ? 'Last source sync failed' : 'فشلت آخر دورة لسحب وتحديث المصادر',
    failedNotice: locale === 'en' ? 'Some sources may not have been updated. Details are recorded in the system audit logs.' : 'قد تكون بعض المصادر لم تُحدث بنجاح؛ التفاصيل موثقة في سجلات النظام وسجل التدقيق.',
    interruptedTitle: locale === 'en' ? 'Last sync interrupted unexpectedly' : 'توقفت آخر عملية سحب قبل اكتمالها',
    interruptedNotice: locale === 'en' ? 'The background worker stopped unexpectedly before finishing all lists.' : 'توقف مسار السحب الخلفي فجأة قبل تسجيل اكتمال كافة القوائم.',
    safetyGuarantee: locale === 'en' ? 'All prior active source versions remain fully active and searchable. Screening is unaffected.' : 'تم الحفاظ على النسخ النشطة السابقة بالكامل دون أي انقطاع لعمليات الفحص والبحث.',
    successTitle: locale === 'en' ? 'Sync completed successfully' : 'اكتملت المزامنة بنجاح',
    recordsImported: locale === 'en' ? 'records updated' : 'سجل تم تحديثه',
    exitCode: locale === 'en' ? 'Exit code' : 'كود الخروج',
    elapsed: locale === 'en' ? 'Elapsed' : 'المدة المنقضية',
  };

  const freqInfo = FREQUENCY_DETAILS[data.scheduleConfig.frequency];
  const freqLabel = locale === 'en' ? freqInfo?.labelEn : freqInfo?.labelAr;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{m.opEyebrow}</div>
          <h1>{m.opTitle}</h1>
          <p>{m.opLead}</p>
        </div>
        <OperationsRefresh label={m.opRefresh} />
      </div>

      {params.sync && (
        <p className="inline-info" role="status">
          {params.sync === 'busy' ? m.opBusy : m.opRequested}
        </p>
      )}

      {/* 1. Operational Overview Hero Banner */}
      <section className={`ops-hero ${overallTone}`}>
        <div className="ops-hero-status">
          <span className="ops-status-icon">
            {overallTone === 'healthy' ? <CheckCircle2 /> : <TriangleAlert />}
          </span>
          <div>
            <span className="eyebrow">{m.opPulseTitle}</span>
            <h2>{overallTone === 'healthy' ? m.opHealthy : m.opAttention}</h2>
            <p>{m.opPulseLead}</p>
          </div>
        </div>
        <div className="ops-hero-actions">
          <SyncControl
            runningRun={running}
            latestRun={latestAny}
            locale={locale}
            labels={syncLabels}
          />
          <span className="ops-record-count">
            <strong><bdi>{number(data.counts.records)}</bdi></strong>
            {m.opRecords}
          </span>
        </div>
      </section>

      {/* 2. Platform Pulse Summary */}
      <section className="ops-pulse" aria-label={m.opPulseTitle}>
        <div className="ops-pulse-item">
          <ListChecks size={19} />
          <div>
            <strong>{m.opSnapshotTitle}</strong>
            <span>{sourcesNeedingReview ? m.opSnapshotIssue : m.opSnapshotGood}</span>
            <small>
              <bdi>{number(data.counts.lists)}</bdi> {m.opSourceOverview} · <bdi>{number(checkedSources)}</bdi> {m.opSourceChecked}
            </small>
          </div>
          <span className={`ops-dot ${sourcesNeedingReview ? 'attention' : 'healthy'}`} />
        </div>
        <div className="ops-pulse-item">
          <Clock3 size={19} />
          <div>
            <strong>{m.opSchedulePulseTitle}</strong>
            <span>{data.scheduleConfig.enabled ? (locale === 'en' ? 'Automation Enabled' : 'التحديث التلقائي مفعّل') : (locale === 'en' ? 'Automation Paused' : 'التحديث التلقائي معطّل')}</span>
            <small>
              {data.scheduleConfig.enabled
                ? <>{locale === 'en' ? 'Next run:' : 'الموعد القادم:'} <bdi>{time(data.scheduleConfig.nextRunEstimated)}</bdi></>
                : (locale === 'en' ? 'Paused by administrator' : 'معطّل مؤقتاً بواسطة المشرف')}
            </small>
          </div>
          <span className={`ops-dot ${data.scheduleConfig.enabled ? 'healthy' : 'attention'}`} />
        </div>
        <div className="ops-pulse-item">
          <Database size={19} />
          <div>
            <strong>{m.opDatabaseTitle}</strong>
            <span>{m.opDatabaseGood}</span>
            <small>{m.opChecked} <bdi>{time(data.checkedAt)}</bdi></small>
          </div>
          <span className="ops-dot healthy" />
        </div>
      </section>

      {/* 3. DUAL CARDS: Latest Manual Sync vs Latest Automatic/Scheduled Sync */}
      <div className="ops-dual-grid">
        {/* Card A: Latest Manual Update */}
        <section className="panel ops-summary-card">
          <div className="panel-heading">
            <div className="ops-card-title-group">
              <span className="ops-card-badge-icon manual">
                <RefreshCw size={17} />
              </span>
              <div>
                <h2>{locale === 'en' ? 'Last Manual Sync' : 'آخر تحديث يدوي'}</h2>
                <p className="muted">
                  {latestManual ? <bdi>{time(latestManual.startedAt)}</bdi> : (locale === 'en' ? 'No manual run recorded' : 'لم يتم تشغيل أي سحب يدوي بعد')}
                </p>
              </div>
            </div>
            <span className={`status ${latestManual?.status === 'success' ? 'neutral' : latestManual?.status === 'running' ? 'blue' : latestManual?.status ? 'amber' : 'neutral'}`}>
              {latestManual ? statusLabel(latestManual.status, m) : (locale === 'en' ? 'None' : 'لا يوجد')}
            </span>
          </div>

          {latestManual ? (
            <div className="ops-card-body">
              <div className="ops-metric-row">
                <div className="ops-stat-item">
                  <span className="stat-label">{locale === 'en' ? 'Finished at' : 'توقيت الانتهاء'}</span>
                  <strong>
                    {latestManual.status === 'running' ? (
                      <span className="text-running">{m.opRunRunning}…</span>
                    ) : (
                      <bdi>{time(latestManual.finishedAt)}</bdi>
                    )}
                  </strong>
                </div>
                <div className="ops-stat-item">
                  <span className="stat-label">{locale === 'en' ? 'Duration' : 'المدة المنقضية'}</span>
                  <strong><bdi>{formatDuration(latestManual.startedAt, latestManual.finishedAt)}</bdi></strong>
                </div>
              </div>

              <div className="ops-metric-row border-top">
                <div className="ops-stat-item">
                  <span className="stat-label">{locale === 'en' ? 'Lists Imported' : 'القوائم المستوردة'}</span>
                  <strong><bdi>{number(latestManual.imported)}</bdi> <small className="muted font-normal">{locale === 'en' ? 'lists' : 'قوائم'}</small></strong>
                </div>
                <div className="ops-stat-item">
                  <span className="stat-label">{locale === 'en' ? 'Records Delta' : 'التغييرات المسجلة'}</span>
                  <div className="delta-chips-wrap">
                    <span className="chip-added has-value">
                      <Plus size={11} />
                      <bdi>+{number(latestManual.added)}</bdi>
                      <small>{locale === 'en' ? 'added' : 'جديد'}</small>
                    </span>
                    <span className="chip-removed has-value">
                      <Minus size={11} />
                      <bdi>−{number(latestManual.removed)}</bdi>
                      <small>{locale === 'en' ? 'removed' : 'محذوف'}</small>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="ops-empty">
              <Play size={20} />
              <p>{locale === 'en' ? 'You can trigger a manual sync at any time using the button above.' : 'يمكنك تشغيل تحديث يدوي للمصادر في أي وقت عبر الزر أعلاه.'}</p>
            </div>
          )}
        </section>

        {/* Card B: Latest Automatic / Scheduled Update */}
        <section className="panel ops-summary-card">
          <div className="panel-heading">
            <div className="ops-card-title-group">
              <span className="ops-card-badge-icon scheduled">
                <CalendarClock size={17} />
              </span>
              <div>
                <h2>{locale === 'en' ? 'Last Automatic Sync' : 'آخر تحديث تلقائي'}</h2>
                <p className="muted">
                  {latestScheduled ? <bdi>{time(latestScheduled.startedAt)}</bdi> : (locale === 'en' ? 'No automated run recorded yet' : 'لم يُسجل تشغيل تلقائي سابق حتى الآن')}
                </p>
              </div>
            </div>
            <span className={`status ${data.scheduleConfig.enabled ? 'neutral' : 'amber'}`}>
              {data.scheduleConfig.enabled
                ? (locale === 'en' ? 'Automated' : 'مجدول نشط')
                : (locale === 'en' ? 'Paused' : 'معطّل مؤقتاً')}
            </span>
          </div>

          <div className="ops-card-body">
            {latestScheduled ? (
              <div className="ops-metric-row">
                <div className="ops-stat-item">
                  <span className="stat-label">{locale === 'en' ? 'Last Run Status' : 'حالة آخر تشغيل'}</span>
                  <strong className={latestScheduled.status === 'success' ? 'text-success' : 'text-danger'}>
                    {statusLabel(latestScheduled.status, m)}
                  </strong>
                </div>
                <div className="ops-stat-item">
                  <span className="stat-label">{locale === 'en' ? 'Delta Added / Removed' : 'الجديد والمحذوف'}</span>
                  <div className="delta-chips-wrap">
                    <span className="chip-added has-value">
                      <Plus size={11} />
                      <bdi>+{number(latestScheduled.added)}</bdi>
                      <small>{locale === 'en' ? 'added' : 'جديد'}</small>
                    </span>
                    <span className="chip-removed has-value">
                      <Minus size={11} />
                      <bdi>−{number(latestScheduled.removed)}</bdi>
                      <small>{locale === 'en' ? 'removed' : 'محذوف'}</small>
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Next Scheduled Run Highlight Banner */}
            <div className={`ops-next-schedule-banner ${data.scheduleConfig.enabled ? 'is-active' : 'is-paused'}`}>
              <div className="next-schedule-icon">
                <Timer size={18} />
              </div>
              <div className="next-schedule-info">
                <div className="next-schedule-title">
                  {locale === 'en' ? 'Next Estimated Sync:' : 'الموعد القادم للفحص التلقائي:'}
                </div>
                <div className="next-schedule-time">
                  <bdi>{formatNextRunTime(data.scheduleConfig.nextRunEstimated, locale)}</bdi>
                </div>
                <div className="next-schedule-freq">
                  {locale === 'en' ? 'Frequency:' : 'معدل التكرار:'} <strong>{freqLabel}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 4. Automated Frequency Control Component */}
      <ScheduleConfigControl
        initialConfig={data.scheduleConfig}
        locale={locale}
        schedulerLoaded={schedulerLoaded}
      />

      {/* 5. Enhanced Sync History Table (Showing Added / Removed Prominently) */}
      <details className="panel ops-disclosure" open>
        <summary>
          <span><Clock3 size={18} />{m.opOpenHistory}</span>
          <small>{m.opRunTitle}</small>
        </summary>
        <div className="table-scroll">
          <table className="ops-history-table">
            <thead>
              <tr>
                <th>{m.opStart}</th>
                <th>{m.opType}</th>
                <th>{m.opStatus}</th>
                <th>{locale === 'en' ? 'Duration' : 'المدة'}</th>
                <th>{m.opImported}</th>
                <th>{locale === 'en' ? 'Changes (Added / Removed)' : 'التغييرات (جديد / محذوف)'}</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map(r => (
                <tr key={r.id}>
                  <td data-label={m.opStart}>
                    <div className="cell-time-stack">
                      <strong><bdi>{time(r.startedAt)}</bdi></strong>
                      {r.finishedAt && (
                        <small className="muted">
                          {locale === 'en' ? 'ended' : 'انتهى'}: <bdi>{new Date(r.finishedAt).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Dubai' })}</bdi>
                        </small>
                      )}
                    </div>
                  </td>
                  <td data-label={m.opType}>
                    <span className={`badge-trigger ${r.trigger}`}>
                      {r.trigger === 'scheduled' ? (
                        <>
                          <CalendarClock size={13} />
                          <span>{m.opScheduled}</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={13} />
                          <span>{m.opManual}</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td data-label={m.opStatus}>
                    <span className={`badge-status-pill ${r.status}`} title={statusLabel(r.status, m)}>
                      {r.status === 'success' && <CheckCircle2 size={13} />}
                      {r.status === 'running' && <RefreshCw size={13} className="spin-animated" />}
                      {(r.status === 'failed' || r.status === 'interrupted') && <TriangleAlert size={13} />}
                      {/* Short label in the table; the full explanation stays in the tooltip */}
                      <span>{r.status === 'failed' ? (locale === 'en' ? 'Partial failure' : 'فشل جزئي') : r.status === 'interrupted' ? (locale === 'en' ? 'Interrupted' : 'متوقفة') : statusLabel(r.status, m)}</span>
                    </span>
                  </td>
                  <td data-label={locale === 'en' ? 'Duration' : 'المدة'}>
                    <span className="badge-duration" dir="ltr">
                      {formatDuration(r.startedAt, r.finishedAt)}
                    </span>
                  </td>
                  <td data-label={m.opImported}>
                    <div className="cell-imported-stack">
                      <strong><bdi>{number(r.imported)}</bdi> <small>{locale === 'en' ? 'lists' : 'قائمة'}</small></strong>
                      <small className="muted"><bdi>{number(r.unchanged)}</bdi> {m.opUnchanged}</small>
                    </div>
                  </td>
                  <td data-label={locale === 'en' ? 'Changes' : 'التغييرات'}>
                    <div className="history-changes-wrap">
                      <span className={`chip-added ${Number(r.added) > 0 ? 'has-value' : 'is-zero'}`}>
                        <Plus size={12} />
                        <bdi>+{number(r.added)}</bdi>
                        <small>{locale === 'en' ? 'added' : 'جديد'}</small>
                      </span>
                      <span className={`chip-removed ${Number(r.removed) > 0 ? 'has-value' : 'is-zero'}`}>
                        <Minus size={12} />
                        <bdi>−{number(r.removed)}</bdi>
                        <small>{locale === 'en' ? 'removed' : 'محذوف'}</small>
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.runs.length && <p className="assessment">{m.opNoRuns}</p>}
      </details>

      {/* 6. Sources Details Table */}
      <details className="panel ops-disclosure">
        <summary>
          <span><Database size={18} />{m.opOpenSources}</span>
          <small>{number(sourcesNeedingReview)} {m.opSourcesNeedReview}</small>
        </summary>
        <div className="ops-disclosure-intro">
          <p>{m.opSourceSub}</p>
          <p>{schedulerText}</p>
          <p>{m.opScheduleLocal}</p>
        </div>
        <div className="table-scroll">
          <table className="ops-sources-table">
            <thead>
              <tr>
                <th>{m.opList}</th>
                <th>{m.opRecordsCol}</th>
                <th>{m.opLastAttempt}</th>
                <th>{m.opLastImportCheck}</th>
                <th>{m.opNew}</th>
                <th>{m.opRemoved}</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map(s => (
                <tr key={s.code}>
                  <td data-label={m.opList} dir="ltr" className="cell-code"><bdi>{s.code}</bdi></td>
                  <td data-label={m.opRecordsCol}><strong><bdi>{number(s.record_count)}</bdi></strong></td>
                  <td data-label={m.opLastAttempt}>
                    <span className={`badge-status-pill ${s.syncStatus?.status === 'success' ? 'success' : s.syncStatus?.status === 'failed' ? 'failed' : 'neutral'}`}>
                      {s.syncStatus?.status === 'failed'
                        ? m.opAttemptFailed
                        : s.syncStatus?.status === 'success'
                        ? m.opAttemptSuccess
                        : m.opAttemptUnknown}
                    </span>
                  </td>
                  <td data-label={m.opLastImportCheck}><bdi>{time(s.imported_at || s.retrieved_at)}</bdi></td>
                  <td data-label={m.opNew}>
                    {s.added !== null && Number(s.added) > 0 ? (
                      <span className="chip-added has-value">
                        <Plus size={11} />
                        <bdi>+{number(s.added)}</bdi>
                      </span>
                    ) : (
                      <span className="chip-zero-added">—</span>
                    )}
                  </td>
                  <td data-label={m.opRemoved}>
                    {s.removed !== null && Number(s.removed) > 0 ? (
                      <span className="chip-removed has-value">
                        <Minus size={11} />
                        <bdi>−{number(s.removed)}</bdi>
                      </span>
                    ) : (
                      <span className="chip-zero-removed">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
