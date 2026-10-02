# V2 Enterprise — نتائج الفحص (مشاكل تحتاج إصلاح)

فحص شامل لفرع `v2-enterprise`. **البناء نضيف (`tsc` 0 أخطاء، `next build` نجح)** والمزايا الجديدة تطبيقات حقيقية (مش وهمية)، والمصادر الـ6 الجديدة أكواد حقيقية في OpenSanctions ✅. لكن فيه المشاكل دي:

---

> **تحديث (تم الإصلاح):** الحرجتان #1 و#2 **اتصلّحتا واتّطبّقتا على القاعدة المحلية واتأكّدت**.
> - #1: السطور الـ3 اتضافت في `scripts/setup-db.ts` (بعد `022_login_rate_limit.sql`).
> - #2: `ENABLE/FORCE ROW LEVEL SECURITY` + سياسة `..._tenant` اتضافت لـ`customer_monitoring_events` و`customer_sar_reports`.
>   - `customer_monitoring_events` أخدت كمان `OR app.platform_owner='true'` في `USING` (قراءة فقط) عشان لوحة السوبر أدمن تجمّع عبر المؤسسات — زي `search_events` في 021. الكتابة فضلت tenant-only في `WITH CHECK`.
>   - **إضافة خارج النطاق الأصلي:** `platform.ts` بيعدّ `customers` cross-org كمان في نفس لوحة المراقبة، فسياسة `customers` اتوسّعت بنفس الـbypass في migration 023 عشان العدّاد يشتغل في الإنتاج (كان هيطلع 0).
> - **التأكيد:** `tsc` 0 أخطاء · اختبار عزل على مستوى الصف كـ`mizan_app` (no-context→0, correct-org→1, bogus-org→0, platform_owner→1) · الاختبارات 59/60 (الفاشل هو #5 أدناه فقط، معتمد على داتا حيّة ومش متأثر بالإصلاح).

---

## 🔴 حرجة (بتكسر مزايا أو أمان) — ✅ تم الإصلاح

### 1) ✅ migrations 023/024/025 مش موصولة في `setup-db.ts`
**الأثر:** في أي إعداد/نشر جديد، الجداول/الأعمدة دي **مش هتتعمل**:
- `023_ongoing_monitoring.sql` → `customer_monitoring_events` + عمود `monitoring_enabled`/`last_monitored_at`
- `024_goaml_sar.sql` → `customer_sar_reports`
- `025_goaml_rear_fari.sql`

فمزايا **المراقبة المستمرة** و**goAML SAR/REAR/FARI** هتقع وقت التشغيل بخطأ «relation/column does not exist». (شغّالة على جهازك دلوقتي فقط لأنك طبّقت الـmigrations يدويًا.)

**الإصلاح:** ضيف السطور دي في `scripts/setup-db.ts` بعد `022_login_rate_limit.sql`:
```ts
await db.query(await readFile('db/023_ongoing_monitoring.sql', 'utf8'));
await db.query(await readFile('db/024_goaml_sar.sql', 'utf8'));
await db.query(await readFile('db/025_goaml_rear_fari.sql', 'utf8'));
```

---

### 2) ✅ الجداول الجديدة بدون Row-Level Security (خطر عزل المؤسسات)
**الملفات:** `db/023_ongoing_monitoring.sql`, `db/024_goaml_sar.sql`
**المشكلة:** `customer_monitoring_events` و`customer_sar_reports` فيهم `organization_id` + `GRANT` لكن **مفيش `ENABLE ROW LEVEL SECURITY` ولا `FORCE ROW LEVEL SECURITY` ولا `CREATE POLICY`** — بعكس كل جداول النظام (customers, customer_screenings...).

**الأثر:** عزل المؤسسات معتمد على فلترة التطبيق بس؛ أي استعلام ينسى شرط المؤسسة → **مؤسسة تشوف تنبيهات مراقبة/بلاغات SAR مؤسسة تانية** (بيانات امتثال حسّاسة).

**الإصلاح:** لكل جدول من الاتنين، ضيف (زي باقي الجداول):
```sql
ALTER TABLE customer_monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_monitoring_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cme_tenant ON customer_monitoring_events;
CREATE POLICY cme_tenant ON customer_monitoring_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
```
(ونفس الشيء لـ`customer_sar_reports`.)

---

## 🟡 متوسطة — ✅ تمت المعالجة

### 3) ⚪ `normalizeName` بيمسح الأرقام العربية — **إيجابية كاذبة (مفيش بَق)**
**الملف:** `src/lib/name-normalization.ts`
النطاق الفعلي في الكود هو `[\u064B-\u065F\u0670\u0640]` (يعني `064B-065F` + `0670` + التطويل `0640`) — **مش بيشمل** الأرقام العربية `٠-٩` (`0660-0669`). الفحص الأصلي قرأ نهاية النطاق غلط. **إثبات:** `normalizeName("٠١٢٣٤٥٦٧٨٩")` → بترجّع الأرقام كاملة؛ التشكيل والتطويل بيتشالوا صح.

### 4) ✅ صفحة `/analytics` بدون تحقّق صلاحية
**الملفات:** `analytics/page.tsx` · `components/navigation.tsx`
**الإصلاح:** الصفحة دلوقتي بتفرض `actor.role === admin` (شاشة «للعرض فقط» زي `team`)، ورابط الناف اتخبّى عن غير الأدمن. البوابة المناسبة هي الدور (لوحة تنفيذية org-level)، مش feature key.

### 5) ✅ اختبار `arabic-search` هشّ
**الملف:** `tests/arabic-search.test.ts`
**السبب:** قائمة `ae_local_terrorists` مش متحمّلة في القاعدة المحلية (0 سجلات) — فالاختبار كان بيفشل لغياب الداتا.
**الإصلاح:** الاختبار بقى **مستقل عن الداتا** — بيجيب اسم حقيقي من القائمة ويتأكد إن كل أشكال الألف/الهمزة تدّي **نفس** النتيجة؛ ولو القائمة فاضية **يتخطّى** بدل ما يفشل.

---

## 🟢 للمراجعة (أولوية أقل) — ✅ تمت المعالجة

### 6) ✅ بلاغات SAR + أحداث المراقبة قابلة للتعديل/الحذف
**الملفات:** `db/024_goaml_sar.sql` · `db/023_ongoing_monitoring.sql`
- `customer_sar_reports` → `GRANT SELECT, INSERT` فقط + `REVOKE UPDATE, DELETE, TRUNCATE` (append-only زي `audit_events`).
- `customer_monitoring_events` → `GRANT SELECT, INSERT, UPDATE` (محتاج UPDATE لعلامة «مقروء») + `REVOKE DELETE, TRUNCATE`.
- الحذف التتابعي عند حذف العميل/المؤسسة بيفضل شغّال (cascade بيستخدم صلاحيات الـFK). طُبّق واتأكّد.

### 7) ✅ التحقق من رفع الملفات
**الملفات:** `api/bulk-screen/route.ts` · `lib/branding.ts` · `branding-settings-card.tsx`
- **Bulk:** بوابة `hasFeature(bulk_screening)` اتضافت على **الـAPI نفسه** (كان ممكن يتتنده مباشرة بتخطّي بوابة الصفحة) + رفض ملف فاضي/>5MB + تحقق الامتداد والـMIME قبل الـparser.
- **Branding (شعار):** تحقق في `saveOrganizationBranding`: data URL لصورة بحد أقصى ~1MB، **يرفض الروابط الخارجية**؛ `primaryColor` hex بس (بيتحقن في ستايل التقارير)؛ سقوف لأطوال النصوص. + تحقق client-side.

---

## ✅ حاجات اتأكدت إنها سليمة
- البناء + typecheck نضيفين (`✓ Compiled successfully`، `tsc` 0 أخطاء).
- goAML XML بيعمل escape للرموز الخاصة → مفيش حقن XML.
- المصادر الـ6 الجديدة أكواد حقيقية في OpenSanctions.
- OCR = محلّل MRZ حقيقي (ICAO 9303)، Bulk = مكتبة xlsx، Monitoring = DB فعلي.
- عزل RLS على الجداول الجديدة مُختبَر على مستوى الصف.

---
## الخلاصة
كل الـ7 findings اتعالجت (#3 طلعت إيجابية كاذبة). الحالة النهائية: `tsc` 0 أخطاء · `next build` نجح · 60 اختبار (59 نجاح / 1 skip / **0 فشل**).
