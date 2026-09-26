import { z } from 'zod';
// Common/GCC countries surfaced first, then every other ISO 3166-1 country; names are rendered
// locale-aware via Intl.DisplayNames, so we only store the codes here. 'OTHER' stays last.
export const countryPinned = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'GB', 'US', 'IN'] as const;
const countryRest = [
  'AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BS', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BT', 'BO',
  'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'CR',
  'CI', 'HR', 'CU', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FJ', 'FI', 'FR', 'GA',
  'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GY', 'HT', 'HN', 'HK', 'HU', 'IS', 'ID', 'IR', 'IQ', 'IE', 'IL',
  'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO',
  'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MR', 'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM', 'NA', 'NR',
  'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT', 'PR', 'RO',
  'RU', 'RW', 'KN', 'LC', 'VC', 'VG', 'WS', 'SM', 'ST', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'SS', 'ES',
  'LK', 'SD', 'SR', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR', 'TM', 'TV', 'UG', 'UA',
  'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'YE', 'ZM', 'ZW',
] as const;
export const countryCodes = [...countryPinned, ...countryRest] as const;
export const countryOptions = [...countryCodes, 'OTHER'] as const;
// Build the localized country list ON THE SERVER and pass it to the form as a prop.
// Intl.DisplayNames output can differ between Node and the browser (e.g. "Hong Kong" vs
// "Hong Kong SAR China"), which would cause a hydration mismatch if computed on the client.
export function localizedCountries(locale: string): [string, string][] {
  const lang = locale === 'en' ? 'en' : 'ar';
  const region = (() => { try { return new Intl.DisplayNames([lang], { type: 'region' }); } catch { return null; } })();
  const name = (code: string) => code === 'OTHER' ? (lang === 'en' ? 'Other' : 'دولة أخرى') : (region?.of(code) ?? code);
  const rest = countryCodes.filter(c => !(countryPinned as readonly string[]).includes(c))
    .map(c => [c, name(c)] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1], lang));
  return [...countryPinned.map(c => [c, name(c)] as [string, string]), ...rest, ['OTHER', name('OTHER')]];
}
export const customerSchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسمًا من حرفين على الأقل').max(160, 'الاسم أطول من الحد المسموح'),
  entityType: z.enum(['individual', 'company'], { error: 'اختر نوع العميل' }),
  country: z.enum(countryOptions, { error: 'اختر الدولة' }),
  nationality: z.string().trim().refine(c => c === '' || (countryCodes as readonly string[]).includes(c), 'اختر جنسية صحيحة').default(''),
  deliveryChannel: z.enum(['', 'face_to_face', 'non_face_to_face', 'online'], { error: 'اختر قناة صحيحة' }).default(''),
  email: z.union([z.literal(''), z.email('البريد الإلكتروني غير صحيح')]).default(''),
  industry: z.string().trim().max(120, 'النشاط أطول من الحد المسموح').default(''),
  dateOfBirth: z.string().trim().max(40, 'التاريخ أطول من الحد المسموح').default(''),
  identifier: z.string().trim().max(80, 'المعرّف أطول من الحد المسموح').default(''),
  notes: z.string().trim().max(2000, 'الملاحظات يجب ألا تتجاوز ٢٠٠٠ حرف').default('')
});
export type CustomerInput = z.infer<typeof customerSchema>;
export const uuidSchema = z.uuid();
export function canManageCustomers(role: string) { return role === 'admin' || role === 'analyst'; }
export const teamUserSchema = z.object({
  email: z.email('البريد الإلكتروني غير صحيح'),
  displayName: z.string().trim().min(2, 'اكتب اسمًا من حرفين على الأقل').max(80, 'الاسم أطول من الحد المسموح'),
  role: z.enum(['admin', 'analyst', 'viewer'], { error: 'اختر الدور' }),
  quota: z.coerce.number({ error: 'اكتب رقمًا' }).int().min(0, 'رقم غير صالح').max(1000000),
  password: z.string().min(12, 'كلمة مرور من 12 حرفًا على الأقل').max(200),
});
export type TeamUserInput = z.infer<typeof teamUserSchema>;
