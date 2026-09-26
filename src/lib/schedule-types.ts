export type ScheduleFrequency = 'every_6h' | 'every_12h' | 'daily' | 'every_48h' | 'weekly';

export type ScheduleConfig = {
  enabled: boolean;
  frequency: ScheduleFrequency;
  timeOfDay: string; // "03:30"
  intervalHours: number;
  lastSavedAt: string;
  updatedBy?: string;
  nextRunEstimated?: string;
};

export const FREQUENCY_DETAILS: Record<
  ScheduleFrequency,
  { hours: number; labelAr: string; labelEn: string; descAr: string; descEn: string }
> = {
  every_6h: {
    hours: 6,
    labelAr: 'كل 6 ساعات (4 مرات يومياً)',
    labelEn: 'Every 6 hours (4x daily)',
    descAr: 'تحديث مكثف مستمر للقوائم الحساسة',
    descEn: 'Continuous intensive sync for dynamic lists'
  },
  every_12h: {
    hours: 12,
    labelAr: 'كل 12 ساعة (مرتان يومياً)',
    labelEn: 'Every 12 hours (2x daily)',
    descAr: 'تحديث صباحي ومسائي متوازن',
    descEn: 'Balanced morning and evening cycle'
  },
  daily: {
    hours: 24,
    labelAr: 'كل 24 ساعة (يومياً في 03:30 ص) · موصى به',
    labelEn: 'Every 24 hours (Daily at 03:30 AM) · Recommended',
    descAr: 'المعيار الرقابي الموصى به لتفادي أوقات الذروة',
    descEn: 'Recommended regulatory standard during off-peak hours'
  },
  every_48h: {
    hours: 48,
    labelAr: 'كل 48 ساعة (كل يومين)',
    labelEn: 'Every 48 hours (Every 2 days)',
    descAr: 'دورة تحديث نصف أسبوعية هادئة',
    descEn: 'Bi-daily incremental sync'
  },
  weekly: {
    hours: 168,
    labelAr: 'أسبوعياً (كل يوم أحد 03:30 ص)',
    labelEn: 'Weekly (Every Sunday at 03:30 AM)',
    descAr: 'تحديث أسبوعي للقوائم منخفضة التغيّر',
    descEn: 'Weekly consolidation for low-velocity lists'
  }
};
