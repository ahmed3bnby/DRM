'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Check, Clock, Play, Power, Save, Sparkles } from 'lucide-react';
import { saveScheduleAction } from '@/app/(workspace)/admin/actions';
import type { ScheduleConfig, ScheduleFrequency } from '@/lib/schedule-types';
import { FREQUENCY_DETAILS } from '@/lib/schedule-types';

type Props = {
  initialConfig: ScheduleConfig;
  locale: string;
  schedulerLoaded: boolean;
};

export default function ScheduleConfigControl({ initialConfig, locale, schedulerLoaded }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState<boolean>(initialConfig.enabled);
  const [frequency, setFrequency] = useState<ScheduleFrequency>(initialConfig.frequency);
  const [timeOfDay, setTimeOfDay] = useState<string>(initialConfig.timeOfDay || '03:30');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const formatNextRun = (isoStr?: string) => {
    if (!isoStr) return locale === 'en' ? 'Disabled / No upcoming run' : 'معطل · لا يوجد موعد تشغيل قادم';
    const d = new Date(isoStr);
    return d.toLocaleString(locale === 'en' ? 'en-GB' : 'ar-EG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dubai'
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);

    const fd = new FormData();
    fd.set('enabled', enabled ? 'true' : 'false');
    fd.set('frequency', frequency);
    fd.set('timeOfDay', timeOfDay);

    startTransition(async () => {
      try {
        await saveScheduleAction(fd);
        setSavedSuccess(true);
        router.refresh();
        setTimeout(() => setSavedSuccess(false), 4000);
      } catch (err) {
        console.error('Failed to save schedule', err);
      }
    });
  };

  const frequencies: ScheduleFrequency[] = ['every_6h', 'every_12h', 'daily', 'every_48h', 'weekly'];

  return (
    <div className="panel schedule-config-card">
      <div className="panel-heading">
        <div className="schedule-head-title">
          <CalendarClock size={20} className="schedule-head-icon" />
          <div>
            <h2>{locale === 'en' ? 'Automatic Updates & Frequency Control' : 'التحكم في التحديثات التلقائية ومعدل التكرار'}</h2>
            <p className="muted">
              {locale === 'en'
                ? 'Configure how often the platform automatically pulls international sanction lists and PEP updates in the background.'
                : 'حدد معدل التكرار التلقائي لسحب وتحديث قوائم العقوبات والمصادر الدولية في خلفية النظام.'}
            </p>
          </div>
        </div>
        <div className="schedule-status-badge">
          <span className={`status-pill-badge ${enabled ? 'active' : 'inactive'}`}>
            <Power size={13} />
            {enabled
              ? (locale === 'en' ? 'Automated Sync Active' : 'التحديث التلقائي مفعّل')
              : (locale === 'en' ? 'Automation Paused' : 'التحديث التلقائي معطّل')}
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="schedule-config-form">
        <div className="schedule-grid">
          {/* 1. Toggle switch */}
          <div className="schedule-field-block">
            <label className="schedule-field-label">
              {locale === 'en' ? 'Automation Status' : 'حالة التحديث التلقائي'}
            </label>
            <div className="schedule-toggle-wrapper">
              <button
                type="button"
                className={`schedule-toggle-btn ${enabled ? 'is-on' : ''}`}
                onClick={() => setEnabled(!enabled)}
                role="switch"
                aria-checked={enabled}
              >
                <span className="toggle-thumb" />
              </button>
              <span className="toggle-label-text">
                {enabled
                  ? (locale === 'en' ? 'Enabled (Runs per schedule)' : 'مفعل (يعمل دورياً وفق الجدول المحدد)')
                  : (locale === 'en' ? 'Disabled (Manual sync only)' : 'معطل (السحب والتحديث يدوي فقط)')}
              </span>
            </div>
          </div>

          {/* 2. Frequency Selector */}
          <div className="schedule-field-block">
            <label className="schedule-field-label" htmlFor="frequency-select">
              {locale === 'en' ? 'Sync Frequency' : 'معدل تكرار التحديث التلقائي'}
            </label>
            <div className="schedule-select-wrapper">
              <select
                id="frequency-select"
                disabled={!enabled}
                value={frequency}
                onChange={e => setFrequency(e.target.value as ScheduleFrequency)}
                className="schedule-select"
              >
                {frequencies.map(f => (
                  <option key={f} value={f}>
                    {locale === 'en' ? FREQUENCY_DETAILS[f].labelEn : FREQUENCY_DETAILS[f].labelAr}
                  </option>
                ))}
              </select>
            </div>
            <small className="schedule-desc-note">
              {locale === 'en' ? FREQUENCY_DETAILS[frequency].descEn : FREQUENCY_DETAILS[frequency].descAr}
            </small>
          </div>

          {/* 3. Next Run & System Meta */}
          <div className="schedule-field-block schedule-meta-block">
            <label className="schedule-field-label">
              {locale === 'en' ? 'Next Estimated Run' : 'موعد التحديث التلقائي القادم'}
            </label>
            <div className="next-run-box">
              <Clock size={16} className="next-run-icon" />
              <strong>{formatNextRun(initialConfig.nextRunEstimated)}</strong>
            </div>
            <div className="scheduler-tech-meta">
              <span className="tech-meta-pill">
                <span className="tech-meta-dot" />
                {schedulerLoaded
                  ? (locale === 'en' ? 'OS Daemon: Active' : 'محرك النظام: نشط ومثبت')
                  : (locale === 'en' ? 'OS Daemon: Local Standby' : 'محرك النظام: في وضع الاستعداد')}
              </span>
              <span className="tech-meta-tz">
                {locale === 'en' ? 'Timezone: UAE (GST)' : 'التوقيت المعتمد: توقيت الإمارات (GST)'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button & Feedback */}
        <div className="schedule-actions-row">
          <button
            type="submit"
            disabled={isPending}
            className="button primary schedule-save-btn"
          >
            {isPending ? (
              <>
                <Clock size={16} className="spin-animated" />
                <span>{locale === 'en' ? 'Applying Settings…' : 'جارٍ حفظ وتطبيق الإعدادات…'}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{locale === 'en' ? 'Save Schedule Settings' : 'حفظ وتطبيق إعدادات الجدولة'}</span>
              </>
            )}
          </button>

          {savedSuccess && (
            <div className="schedule-save-toast">
              <Check size={16} />
              <span>{locale === 'en' ? 'Schedule settings updated successfully!' : 'تم حفظ وتحديث إعدادات الجدولة بنجاح!'}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
