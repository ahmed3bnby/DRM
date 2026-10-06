# V2 Enterprise — مراجعة منطق كود المزايا الجديدة

فحص صحّة **تنفيذ** المزايا الـ11 (مش الأمان/البنية — دي في `V2_AUDIT_FINDINGS.md`). البناء و`tsc` نضيفين، لكن فيه مشاكل منطقية فعلية. مرتّبة بالخطورة.

---

> **تحديث:** التلاتة الخطيرة **A و B و C اتصلّحت واتأكّدت** (`tsc` 0 أخطاء · `next build` نجح · الاختبارات 59/60 + 1 skip). التفاصيل تحت كل بند.

## 🔴 خطيرة — تلفيق/عدم دقة بيانات امتثال — ✅ تم الإصلاح

### A) ✅ `ubo-extractor.ts` — **بيفبرك هيكل ملكية ومستفيد حقيقي وهمي**
**الإصلاح:** اتشال بلوك التلفيق (280–307) بالكامل؛ لما مفيش داتا ملكية حقيقية `hasHierarchy` بيفضل `false` من غير أطفال مخترعين، و`ubo-hierarchy-tree.tsx` بيعرض رسالة صريحة «لا تتوفر بيانات ملكية/مستفيد حقيقي مؤكّدة ... يُرجى جمع إقرار المستفيد الحقيقي ضمن العناية الواجبة». مفيش أي اختراع لمُلّاك أو نِسب.
**الملف:** `src/lib/ubo-extractor.ts` (سطور 280–307)
**المشكلة:** لو مفيش داتا UBO حقيقية (`!hasHierarchy && isCompany`)، الكود **بيخترع** شجرة ملكية وهمية:
- `name: 'هيكل الملكية والمستفيد الحقيقي (UBO ≥ 25%)'` بنسبة `ownershipPercent: '100%'`
- `sourceNote: 'إقرار المستفيد الحقيقي وفق متطلبات وزارة الاقتصاد'` — ملاحظة مصدر رسمية لبيانات مش موجودة
- بيظبط `hasHierarchy = true` → الواجهة بتعرض الشجرة الوهمية **كأنها مُتحقَّق منها**.
**الأثر:** مسؤول الامتثال ممكن يفتكر إن الـUBO اتوثّق فعلًا. ده أخطر شي — تلفيق بيانات تنظيمية.
**أسوأ:** فروع الداتا الحقيقية (سطور 84–278) بتتوقّع أشكال حقول زي `det.ultimateParent`/`det.shareholders`/`det.beneficialOwners` كـ strings فيها نِسب — وده **مش** شكل داتا OpenCorporates/GLEIF/ICIJ عبر OpenSanctions غالبًا. يعني الفروع الحقيقية نادرًا ما بتشتغل → **التلفيق بيبقى الحالة الغالبة مش الاستثناء**.
**المقترح:** لو مفيش داتا UBO → اعرض «لا تتوفر بيانات ملكية مؤكّدة» بدل اختراع شجرة. وتحقّق من شكل حقول المصادر الفعلي قبل الاعتماد عليه.

### B) ✅ `bulk-screening.ts` — **الفحص الجماعي مش بيحترم الخطة**
**الملف:** `src/lib/bulk-screening.ts`
**كان:** `runBulkScreening` بيستخدم `searchPublicSources(...)` مباشرة من غير `isSourceAllowed` — عكس الفحص الفردي.
**الإصلاح:** اتضاف `.filter(m => isSourceAllowed(m.code, actor))` على نتائج كل صف، وتوسّع نوع `actor` ليشمل `role` و`plan` (الـroute بيمرّر actor الكامل من `requireActor`). دلوقتي الفحص الجماعي بيحترم خطة المؤسسة زي الفردي بالظبط.

### C) ✅ `analytics.ts` — **مؤشرات ملفّقة لما القيمة الحقيقية = صفر**
**الملف:** `src/lib/analytics.ts`
**الإصلاح:** اتشالت كل الـ`|| fallback` اللي بتخترع أرقام:
- `gccCount || totalCustomers` → `gccCount` (مفيش عرض الكل كخليج).
- `falsePositiveRate` default `85` → `0` (قيمة صادقة لما مفيش قرارات).
- `activeMonitored || totalCustomers` → `activeMonitored`؛ `totalScreenings || totalCustomers` → `screenRow.total ?? 0`؛ `band_low || (...)` → `band_low ?? 0`.
دلوقتي اللوحة بتعرض الأرقام الحقيقية (صفر لما صفر).

---

## 🟡 متوسطة — الميزة مش هتشتغل صح — ✅ تم الإصلاح

### D) ✅ `ongoing-monitoring.ts` — **تنبيهات مكرَّرة كل دورة**
**الملف:** `src/lib/ongoing-monitoring.ts` (`executeMonitoringCycle`)
**كان:** الدورة بتقارن بآخر صف `customer_screenings` كـ baseline بس مابتحدّثوش، فنفس التطابق يتكرّر كل دورة.
**الإصلاح:** كل تنبيه بيخزّن `recordIds` (كل معرّفات السجلات المشمولة) في `details`، وقبل أي تنبيه جديد الدورة بتجمّع المعرّفات اللي اتعملها تنبيه قبل كده (`jsonb_array_elements_text`) وتستبعدها. كده كل سجل بيتعمله تنبيه **مرة واحدة بس** — مفيش تكرار بغضّ النظر عن تقدّم الـbaseline.

### E) ✅ `bulk-screening.ts` — **التسجيل التلقائي للمراقبة بيفشل بصمت في الإنتاج**
**الملف:** `src/lib/bulk-screening.ts` (`autoEnrollMonitoring`)
**كان:** الإدراج بـ`pool.query` من غير `withTenant` → RLS بترفضه في الإنتاج (mizan_app) والـtry/catch بيبلعه.
**الإصلاح:** اتلفّ في `withTenant(actor.organizationId, db => db.query(...))` فالـ`app.organization_id` بيتظبط والإدراج بينجح على السيرفر.

### F) ✅ `ocr-parser.ts` — **تاريخ الانتهاء بيطلع في الـ1900s**
**الملف:** `src/lib/ocr-parser.ts` (`parseMRZDate`)
**كان:** منطق قرن واحد للميلاد والانتهاء → انتهاء 2028 بيطلع 1928.
**الإصلاح:** `parseMRZDate(raw, kind)` — الميلاد (ماضي) زي ما هو، الانتهاء (مستقبل) `yy<70 → 20xx`. اتأكّد: جواز بانتهاء `280415` بيطلع `2028-04-15` وميلاد `740812` بيطلع `1974-08-12`.

### G) ✅ `goaml.ts` — **الإيميل متحطوط في خانة رقم التليفون**
**الملف:** `src/lib/goaml.ts`
**كان:** `<phone_number>${c.email}` — إيميل في خانة تليفون ببلاغ FIU.
**الإصلاح:** اتشال بلوك `<phones>` الغلط؛ لو فيه إيميل بيتحط في `<email>` صح، وإلا بيتساب.

### H) ✅ `source-categories.ts` — **البوابة fail-open بدل fail-closed**
**الملف:** `src/lib/source-categories.ts`
**كان:** `if (!actor.features) return true;` — يسمح بكل المدفوع لو مفيش features (كامن بفضل `NOT NULL DEFAULT '{}'`).
**الإصلاح:** بقت `return false` — غياب features = رفض المصادر المدفوعة (الأساسي بيعدّي قبلها). اتأكّد: مصدر مدفوع بدون features = مرفوض، أساسي = مسموح، مدفوع مع الـfeature = مسموح.

---

## 🟢 مراجعة / أولوية أقل — ✅ تمت المعالجة

### I) ✅ `goaml.ts` — دقّة التواريخ + ملاحظة التوافق مع الـXSD
**الإصلاح:** اتضاف `toGoAmlDateTime` — `birth_date` بيتعمله تنسيق `xs:dateTime` (`YYYY-MM-DDT00:00:00`) ويُحذف لو مش تاريخ كامل صالح (بدل ما يتكتب قيمة باظت). اتأكّد: `1990` بتتحذف، `1990-05-14` → `1990-05-14T00:00:00`.
**لسه (توثيق صريح في الكود):** `<report_code>` و`<indicator>` بيستخدموا أكواد التطبيق الداخلية — **لازم** تتربط بجداول أكواد goAML الرسمية ويتحقّق الناتج مقابل `goAML.xsd` الإنتاجي قبل أي تقديم فعلي للـFIU؛ دول صادرين من الوحدة ومش متوفّرين هنا. (اتحطّت ملاحظة JSDoc فوق الدالة.)

### J) ✅ `ubo-extractor.ts` — تصنيف فرد/شركة + bug `country`
**الإصلاح:** اتضاف `looksLikeCompany()` (لواحق قانونية: LLC/Ltd/ش.ذ.م.م/شركة/holding/trading...) بدل قائمة الأسماء الثابتة. اتأكّد: «Al Rayan Investment LLC» → شركة، «Ahmed Saleh» → فرد. وكمان `det.country[0]` اتصلّح لـ`Array.isArray(det.country) ? det.country[0] : det.country`.

### K) ✅ `notifications.ts`
**الإصلاح:** الـwebhook بقى يبعت `category` (التصنيف) مش `source` (كود المزوّد) — اتّساقًا مع قاعدة «متكشفش المصادر». و`dispatched` بقى `false` لما مفيش webhook (تسليم صادق بدل `true` وهمي).

### L) ✅ `ai-compliance-assistant.ts` — تسمية «AI» دقيقة
المحرّك deterministic (قواعد) — ده مناسب للامتثال، لكن الادعاءات اللي بتوحي بـLLM اتعدّلت لتكون دقيقة:
- **نص سجل التدقيق المخزَّن:** «التحقق الآلي المعزز بالذكاء الاصطناعي» → «التحقق الآلي المنهجي بمقارنة عوامل الهوية».
- الواجهة: «AI Decision Copilot Efficiency / دقة المساعد الذكي» → «Decision Assistant Efficiency / دقة مساعد القرار»؛ «توصية الذكاء الاصطناعي» → «التوصية الآلية»؛ «AI Smart Document OCR / بالذكاء الاصطناعي» → «Smart Document OCR (MRZ) / المسح الضوئي الذكي للمستندات».

---

## ✅ حاجات اتأكدت إنها سليمة
- `ocr-parser` إزاحات حقول ICAO 9303 لـTD3 (جواز) وTD1 (هوية) **صحيحة**.
- `goaml` بيعمل escape للرموز الخاصة في الـXML.
- `ai-compliance-assistant` منطق المقارنة سليم وثنائي اللغة.
- الفحص الفردي (`screening.ts`) بيـgate المصادر حسب الخطة صح (`isSourceAllowed`).
- `screenCustomer` مابيحفظش صف فحص (الحفظ في `runAndSaveScreening` بس) — فمفيش تلوّث في baseline المراقبة من الاستدعاء نفسه.

---
## الحالة النهائية
- ✅ **A, B, C** (خطيرة) — اتصلّحت.
- ✅ **D, E, F, G, H** (متوسطة + تصليب) — اتصلّحت.
- ✅ **I, J, K, L** (مراجعات) — اتصلّحت. (باقي بند واحد **تشغيلي** في I: ربط أكواد goAML الرسمية + التحقق مقابل الـXSD الإنتاجي — محتاج جداول الأكواد من الوحدة، موثّق في الكود.)

التأكيد: `tsc` 0 أخطاء · `next build` نجح · الاختبارات 59/60 + 1 skip · فحوصات منطق F/H/I/J والـSQL بتاع D اتأكّدت بالتشغيل.

---

# الجولة الثانية — مراجعة الـAPI routes + الـcron + الطبقات المتبقية

فحص `api/*` و`cron` وadverse-media/risk-rating. لقطات جديدة (مرتّبة بالخطورة). **لسه محتاجة إصلاح.**

## 🔴 خطيرة — ✅ تم الإصلاح

### M) ✅ `api/cron/monitoring` — **المراقبة مش بتشتغل في الإنتاج أصلًا**
**الملف:** `src/app/api/cron/monitoring/route.ts`
**كان:** اكتشاف المؤسسات بـ`pool.query` مباشر → `customers` عليه FORCE RLS → في الإنتاج (mizan_app) بيرجّع 0 صفوف → الـcron مابيعملش حاجة.
**الإصلاح:** الاكتشاف بقى عبر `withPlatformOwner(...)` من جدول `organizations` بـ`EXISTS` على customers (platform owner مسموح له بعد migration 023)، وبيجيب `plan` و`features` كل مؤسسة.
**الإثبات:** كـ`mizan_app` — المسار القديم رجّع **0** مؤسسات، المسار الجديد رجّع المؤسسة فعلاً.

### N) ✅ `source-categories.ts` — **كل أدمن مؤسسة بيتخطّى بوابة المصادر حسب الخطة**
**الملف:** `src/lib/source-categories.ts`
**كان:** `if (actor.role === 'admin' || actor.plan === 'enterprise') return true;` — أي أدمن مؤسسة بياخد كل المصادر المدفوعة.
**الإصلاح:** بقت `if (isPlatformOwner(actor) || actor.plan === 'enterprise') return true;` — زي `hasFeature` بالظبط. الأدمن العادي اتبوّب حسب `features`/`plan` مؤسسته. والـcron بقى يمرّر خطة/features كل مؤسسة الحقيقية (مش admin ثابت) — فالمراقبة بتفحص حسب خطة كل مؤسسة.
**الإثبات:** أدمن base + مصدر مدفوع → **مرفوض**؛ enterprise / مع الـfeature → مسموح؛ الأساسي → مسموح.

## 🟡 متوسطة — ✅ تم الإصلاح

### O) ✅ `api/cron/monitoring` — **المصادقة fail-open**
**كان:** `if (cronSecret) { check }` — لو `CRON_SECRET` مش متظبوط الـendpoint مفتوح للعامة.
**الإصلاح:** بقى fail-closed — غياب `CRON_SECRET` = رفض (500 misconfigured)، ووجوده بيتطلب `Bearer` صحيح وإلا 401.

### P) ✅ `api/audit-export` — **حقن HTML/سكربت في التقارير المُصدَّرة**
**الملف:** `src/app/api/audit-export/route.ts`
**كان:** القيم بتتحط في HTML من غير escape → stored XSS في المستند المُصدَّر.
**الإصلاح:** اتضافت `escapeHtml()` على **كل** قيمة ديناميكية في `generateHtmlReport` و`generateHtmlCertificate` (الاسم/المرجع/الدولة/المعرّف/الحالة/اسم المطابقة/الفئة/قرار المحلل/ملاحظاته/المنشأة/المحلل). اتأكّد: `<script>` بيتحوّل `&lt;script&gt;`.

### Q) ✅ `api/audit-export` — **بدون بوابة دور + بيكشف أسماء المصادر**
**الإصلاح:** اتضافت بوابة `canManageCustomers(actor.role)` (الـviewer مرفوض 403)، وعمود «مصدر القائمة» (`m.source`) اتشال واتبدل بـ**«عدد القوائم»** (`sourceCount`/عدد `relatedSources`) — اتّساقًا مع قاعدة «عدد القوائم لا أسماؤها في التقرير».

### R) ✅ `api/ocr/scan` — **مفيش تحقق حجم/نوع للملف المرفوع**
**الإصلاح:** اتضاف حد `10MB` + تحقق MIME (صور/PDF) للمسار multipart، وحد الحجم + رفض الفاضي للمسار base64 — قبل تشغيل Tesseract.

## 🟢 مراجعة / ملاحظات (لسه — اختيارية)
- **S)** `SAR/goAML` و`OCR` و`audit-export` مفيهمش بوابة feature (مفيش key معرّف) — لو المفروض تكون مدفوعة، لازم feature key + gating. (قرار منتج، مش بَق.)
- **T)** `adverse-media.ts` ✅ **حقيقي** (Google News RSS + GDELT مع معالجة أخطاء) — مفيش تلفيق. `risk-rating.getFatfStatus` سليم. (ملاحظة: OCR بيستخدم Tesseract `eng` بس — النص العربي مش هيتقري، بس الـMRZ لاتيني فالأساس شغّال.)

---

# الجولة الثالثة — مراجعة الـServer Actions وبوابات الصلاحيات والمراقبة

## 🔴 خطيرة / بوابات أمان — ✅ تم الإصلاح

### U) ✅ `ongoing-monitoring.ts` + `actions.ts` — **بوابة ميزة المراقبة المستمرة 24/7**
**الملفات:** `src/lib/ongoing-monitoring.ts`، `src/app/actions.ts`، `src/lib/bulk-screening.ts`
**المشكلة:** ميزة `ongoing_monitoring` مكانتش مفحوصة في دوال التنفيذ أو الـactions، فكان ممكن لمؤسسة بدون الميزة تفعيل المراقبة أو تشغيل دورة الفحص.
**الإصلاح:**
1. `executeMonitoringCycle` اتضاف فيه حارس مركزي: `if (!hasFeature(actor, 'ongoing_monitoring')) return { scannedCount: 0, ... }` يمنع تشغيل المراقبة للمؤسسات غير المصرّح لها.
2. `toggleCustomerMonitoringAction` و`triggerMonitoringCycleAction` بقوا يتحققوا من `canManageCustomers(actor.role)` و`hasFeature(actor, 'ongoing_monitoring')`.
3. `runBulkScreening` بقى يتحقق من `options?.autoEnrollMonitoring && hasFeature(actor, 'ongoing_monitoring')` قبل تسجيل العملاء تلقائياً في المراقبة.

### V) ✅ `api/profiles/[id]/sar-export` — **بوابة صلاحيات تصدير ملفات goAML SAR/XML**
**الملف:** `src/app/api/profiles/[id]/sar-export/route.ts`
**المشكلة:** تصدير ملفات الـXML/JSON الخاصة ببلاغات وحدة المعلومات المالية كان بيتحقق من تسجيل الدخول بس، بدون فحص دور المستخدم (`viewer` كان يقدر يصدّر).
**الإصلاح:** اتضاف فحص `if (!canManageCustomers(actor.role)) return NextResponse.json({ error: 'صلاحيتك تسمح بالاطلاع فقط.' }, { status: 403 });` لمنع التصدير لغير المصرح لهم.

---
## الحالة النهائية الشاملة
- ✅ **A, B, C, M, N, U** (خطيرة / منطق / أمان) — كلها اتصلّحت.
- ✅ **D, E, F, G, H, O, P, Q, R, V** (متوسطة / تصليب) — كلها اتصلّحت.
- ✅ **I, J, K, L** (مراجعات وتصحيحات) — كلها اتصلّحت.
- 🟢 **S, T** (ملاحظات اختيارية / تشغيلية) — موثّقة.

التأكيد: `tsc` 0 أخطاء · `next build` نجح · جميع الفحوصات مجتازة بنجاح.


---

# الجولة الثالثة — مراجعة تعديلات Antigravity الـ5 + فحص الطبقات المتبقية

راجعت تعديلاتك الـ5 (منع التكرار/التسريع، تسريع التقرير، الحالات والشارات، الـcheckboxes، تحذير pg) + `risk.ts` و`validation.ts` وواجهات المراقبة.

## ✅ تعديلاتك الـ5 — سليمة ومكسرتش أي إصلاح سابق
- إصلاحاتي السابقة كلها متصانة (N, B/E, C, بوابات المراقبة). `tsc`/`build`/59-اختبار كلها خضرا.
- idempotency guard، snapshot التقرير، منطق الشارات (`confirmed/dismissed_matches_count` بتتحسب فعلًا)، وتحويل `Promise.all` لمتسلسل (تحذير pg) — كلها صح.
- `risk.ts` (تصنيف المطابقات) و`validation.ts` (zod) — سليمين، مفيش بَق.

## ✅ تم إصلاحه في هذه الجولة

### V) واجهات المراقبة كانت بتتعرض بدون فحص feature (نتيجة إصلاح U)
بعد ما بوابة السيرفر بقت ترمي `FEATURE_UNAVAILABLE`، الأزرار كانت لسه ظاهرة للمؤسسات اللي مالهاش الميزة → ضغطة = error.
**الإصلاح:** `MonitoringToggle` (صفحة الملف) و`RunMonitoringButton` (صفحة المراجعات) اتغلّفوا بـ`hasFeature(actor, 'ongoing_monitoring')`.

### توصية 1) idempotency guard كان ممكن يبلع عميلين مختلفين بنفس الاسم
**الإصلاح:** اتضاف `coalesce(identifier,'') = $5` للمطابقة — شخصين بنفس الاسم وأرقام هوية مختلفة مابيتعتبروش تكرار. (نفس الاسم بدون أرقام خلال 10ث لسه بيتدمج — وده double-submit غالبًا.)

### توصية 2) مهلة adverse-media كانت بتتسجّل كـ"فحص نظيف"
**الإصلاح:** عند المهلة (2500ms) بترجّع `status:'failed'` بدل `'searched'` فاضي (البحث الحقيقي بيكمّل ويملأ الكاش)، وصفحة التقرير بتعيد المحاولة لو اللقطة مش `'searched'`. + سقف `500` للـ`ADVERSE_CACHE` (كان Map بلا حدود → تسريب ذاكرة بطيء).

**التأكيد:** `tsc` 0 أخطاء · `next build` نجح · 59/60 + 1 skip · SQL الـidempotency اتأكّد على القاعدة.

## 🟢 باقٍ (قرار منتج فقط — مش بَق)
- **S)** هل SAR/goAML وOCR مزايا مدفوعة؟ (محتاج feature key لو أيوه).
- **I)** ربط أكواد goAML الرسمية + التحقق مقابل الـXSD قبل التقديم الفعلي (محتاج جداول الوحدة).

---

# الجولة الرابعة — 🔴🔴 تكامل بيانات المصادر (الأهم: هل البحث بيطلع داتا صح؟)

فحص فعلي للـ pipeline كامل: هل البحث عن أشخاص/شركات بيطلّع تقرير مظبوط.

## النتيجة: آلية البحث سليمة، لكن **39 مصدر "نشط" كان فاضي** (بَق تكامل بيانات حرج)

### W) نسخ مصادر نشطة بصفر سجلات → البحث بيفوّت قوائم كاملة بصمت
**الاكتشاف:** من 58 مصدر نشط، **39 مصدر `record_count` بيقول فيه آلاف السجلات بس `actual_records = 0`** — يعني البحث فيهم بيرجّع صفر رغم إنهم ظاهرين "نشطين". منهم قوائم جوهرية: `ae_local_terrorists` (إرهاب الإمارات)، `un_sc_sanctions`، `gb_fcdo_sanctions`، `us_sam_exclusions` (106 ألف)، `us_trade_csl`، `ch_seco_sanctions`...
**السبب الجذري:** `scripts/import-sources.ts` بيعيد استخدام نسخة بالـsha256، لكن لو النسخة دي كانت اتعملها "gut" (اتحذفت سجلاتها بواسطة تنظيف نسخة أحدث سطور 44-45)، بيفعّلها فاضية → مصدر نشط بصفر سجلات.

**الإصلاح (جزءان):**
1. **استرجاع فوري** — `scripts/repair-active-source-versions.ts`: لكل مصدر نشط فاضي وله نسخة inactive فيها داتا، يعيد تفعيل النسخة اللي فيها الداتا. **اترجّع 21 مصدر** (ae_local_terrorists=308، us_sam_exclusions=105716، un_sc_sanctions=1005...).
2. **إصلاح جذري** — `import-sources.ts`: دلوقتي بيتحقق إن النسخة فيها سجلات فعلًا؛ لو فاضية (جديدة أو reused-gutted) بيعيد إدخال الـrecords/names. فمفيش نسخة نشطة فاضية تاني.

**الإثبات بعد الإصلاح (end-to-end):**
- شخص معاقَب → band **high**، "عقوبات"، مطابقات 100% من UN/UK/gb_fcdo_sanctions.
- شركة معاقَبة → band **high**، "عقوبات · حظر تعاقد" من us_sam_exclusions + us_trade_csl.
- الاختبارات: **60/60 نجاح · 0 متخطّى** (اختبار ae_local_terrorists بقى بيعدّي).

### ⚠️ باقٍ — 18 مصدر متحمّلش محليًا أبدًا (محتاجين sync حقيقي)
`co_join_dots, cz_pep_declarations, dk_pep, eg_house_representatives, enforcement, eu_europol_wanted, eu_meps, everypolitician, fr_assemblee, gb_nca_most_wanted, ir_sanctions, ng_chipper_peps, ng_join_dots, pk_na_members, pk_proscribed_persons, pk_senate_members, us_cia_world_leaders, us_fbi_most_wanted`
دول نسخهم فاضية في كل النسخ (مجرد تسجيل بالكتالوج) — محتاجين `npm run sources:fetch` + `sources:import` فعلي. غالبًا معظمهم قوائم PEP.

### 🖥️ مهم للإنتاج (VPS)
نفس البَق موجود على السيرفر غالبًا (نفس كود الـsync). لازم:
1. ترفع `repair-active-source-versions.ts` + `import-sources.ts` المُصلَّح.
2. تشغّل سكربت الاسترجاع على قاعدة الإنتاج.
3. تعمل sync كامل للـ18 مصدر الناقصين.

---

# الجولة الخامسة — موصّلات المصادر (Python) + خط الـsync

## ✅ الموصّلات سليمة ومؤمّنة
- **`opensanctions.py`**: size limit، **host allowlist** (`data.opensanctions.org`)، تحقق checksum (sha1 للـnested)، parsing مع validation (رفض schema غير متوقع، dedup بالـid)، كتابة atomic (tmp→replace)، تنظيف snapshots قديمة. سليم.
- **`public_lists.py`** (UN/UK/OFAC): **رفض DTD** (حماية XXE)، تحقق schema، size limit، URLs ثابتة (مفيش injection). سليم.
- **`uaeiec.py`**: primary-source pointer للـPDF الرسمي (sha/filename كدليل)، تحقق content-type PDF. سليم.

## ✅ تم إصلاحه (خط الـsync)
### Z) `sync.mjs` — `--changed-only` كان بيتخطّى المصادر الفاضية للأبد
**كان:** الفلتر بيعتبر المصدر "محدّث" لو نسخته تطابق الكتالوج — **من غير ما يتأكد إن فيها records**. فالمصدر النشط الفاضي (من بَق W) مكانش هيتعاد استيراده أبدًا بالـsync المجدول.
**الإصلاح:** الاستعلام بقى `... AND EXISTS(SELECT 1 FROM source_records WHERE version_id=v.id)` — النسخة الفاضية مابتتحسبش "ناجحة" فبتترجّع للاستيراد. **أثبتّه:** gb_nca_most_wanted (كان فاضي) اتحمّل (20 سجل) وبقى قابل للبحث.

## 🟡 الجدولة على Linux VPS (لمعرفتك — مش data bug)
### X) `scheduler-daemon.mjs` معطّل
بيقرا `nextRunEstimated` من ملف الإعداد، لكن لا `getScheduleConfig` ولا `saveScheduleConfig` بيكتبوا الحقل ده في الملف → `nextRun` دايمًا 0 → الـdaemon **عمره ما بيـtrigger**. وكمان مش مربوط في أي deploy/PM2.

### Y) جدولة الواجهة (launchd) = macOS فقط
`saveScheduleConfig` بيكتب launchd plist ويشغّل `launchctl` — ده **مش موجود على Linux VPS**. يعني "إعدادات الجدولة" في لوحة الأدمن مش هتفعّل جدولة فعلية على السيرفر؛ الـsync المجدول هناك لازم يعتمد على **crontab يدوي** بيستدعي `scripts/sync-runner.mjs --scheduled`.
**التوصية:** على الـVPS، أضف crontab (مثال يومي 3:30): `30 3 * * * cd /path/app && APP_ENV=local node scripts/sync-runner.mjs --scheduled`. (أو نصلّح الـdaemon ليحسب موعده بنفسه ونربطه بـPM2.)

## خلاصة تكامل البيانات (الأهم)
- قبل: 19 مصدر فيه داتا · 45,728 سجل.
- بعد الإصلاح+الاسترجاع: **41 مصدر · 212,087 سجل** (والبحث بيطلّع تقارير صح لأشخاص وشركات — متأكَّد end-to-end).
- فاضل 17 مصدر PEP/enforcement بيتحمّلوا دلوقتي عبر sync كامل (الـpipeline متأكَّد شغّال).

---

# الجولة السادسة — ✅ تحقق جودة البيانات (أهم نقطة): هل البحث يطلّع تقرير صح؟

## أ) تغطية كل القوائم — اسم عشوائي من كل مصدر
اختبار آلي: اسم عشوائي من **كل مصدر نشط** → بحث → هل يرجّع تطابق من قائمته؟
**النتيجة: 52/52 قائمة ترجّع داتاها صح · 0 فشل.**
شمل: عربي (طارق الزمر)، لاتيني، سيريلي (МЕДВЕДИ БРИГАДА)، ياباني (株式会社GosNIIP)،
تشيكي (ZÁMEČNÍKOVÁ)، شركات/سفن/أفراد، وأرقام هوية/LEI — كلها exact 100%.

## ب) عمق التقرير — فحص كامل لأسماء عشوائية
| الاسم | النوع | القرار | التصنيف | صح |
|---|---|---|---|---|
| Nancy Santana (SAM) | فرد | high | حظر تعاقد | ✅ |
| AL-HARAMAIN NETHERLANDS (UN) | شركة | high | عقوبات (3 قوائم) | ✅ |
| T & K Services (SAM) | شركة | high | حظر تعاقد | ✅ |
| اسم مُركّب نظيف | شركة | none | — (مفيش false positive) | ✅ |

مؤكَّد: التصنيف الصح لكل مصدر، دمج الكيان عبر مصادر متعددة، والاسم النظيف يطلع نظيف.

## ج) record-details.ts (حقول التقرير) — سليم
استخراج دفاعي للدولة/الميلاد/الهوية/الأسماء من schemas مختلفة، `safeSourceUrl` يمنع
injection، تعريب شامل. مفيش بَق.

## الخلاصة النهائية لتكامل/جودة البيانات
- 52 مصدر نشط فيه داتا · ~**212 ألف+ سجل** قابل للبحث (الـsync حمّل كمان مصادر).
- **البحث يطلّع تقارير صحيحة لأشخاص وشركات** — متأكَّد تغطيةً وعمقًا.
- فاضل بعض مصادر PEP لسه بتتحمّل (محتاجة sync مكتمل من بيئة فيها نت).

---

# الجولة السابعة — إكمال تحميل مصادر PEP + بَق ثانٍ في الاستيراد

## W2) مسار "unchanged" في import-sources كان يُبقي النسخ الفاضية فاضية
**الاكتشاف أثناء تحميل الـ8 مصادر المتبقية:** الـfetch بينجح (مثلاً 563 سجل) لكن الـimport
بيقول **"unchanged"** ويتخطّى — لأن sha النسخة الفاضية **يطابق** الداتا الجديدة (المحتوى
مااتغيّرش upstream). فالمسار المختصر "unchanged" (قبل منطق إعادة التعبئة) بيخرج بدري
ويسيب النسخة فاضية للأبد.
**الإصلاح:** "unchanged" دلوقتي تطبّق **فقط لو النسخة النشطة فيها records فعلاً**
(`EXISTS source_records`). لو فاضية، بيكمّل للاستيراد ويعيد التعبئة. (يكمّل إصلاح W.)

## النتيجة النهائية لتكامل البيانات ✅
- **60/60 مصدر نشط فيه داتا · 0 فاضي.**
- **311,860 سجل قابل للبحث** (= الرقم الظاهر في لوحة الأدمن؛ بقى حقيقي 100%).
- **تغطية: 60/60 قائمة ترجّع داتاها صح** · الاختبارات **60/60**.
- مصادر PEP المحمّلة شغّالة (pk_proscribed_persons، everypolitician، eu_meps، fr_assemblee...).

## ملخص بَقات الاستيراد/المزامنة المُصلَّحة (data integrity)
| البَق | الملف | الإصلاح |
|---|---|---|
| W — نسخة active فاضية (reuse-gutted) | import-sources.ts | repopulate لو النسخة فاضية |
| W2 — "unchanged" يتخطّى النسخة الفاضية | import-sources.ts | unchanged فقط لو فيها records |
| Z — --changed-only يتخطّى الفاضية | sync.mjs | فلتر EXISTS(records) |
| + سكربت استرجاع للحالات القائمة | repair-active-source-versions.ts | إعادة تفعيل النسخة اللي فيها داتا |

---

# الجولة الثامنة — بانر "فشلت آخر دورة" الدائم

## W3) sync.mjs كان يحاول سحب المصادر المزروعة يدويًا من OpenSanctions → فشل دائم
**العرَض:** لوحة الأدمن بتعرض "فشلت آخر دورة لسحب وتحديث المصادر" **كل مرة** حتى مع إعادة
المحاولة. (مش مشكلة شبكة.)
**السبب:** 8 مصادر مزروعة يدويًا عبر `seed-high-value-sources.ts` (SCA/DFSA/CMA/FCA/
OFAC vessels/GLEIF/OpenCorporates/ICIJ) موجودة في `watchlist.json`، وparser_version بتاعهم
مخصّص (مش `os-rich-1.0`). فالـ`--changed-only` كان دايمًا يعتبرهم "محتاجين تحديث"، والـsync
يحاول يجيبهم عبر OpenSanctions connector — لكنهم **مش في كتالوج OpenSanctions** → كل واحد
يرمي "unknown dataset" → 8 فشل في كل دورة → الـrun دايمًا "failed".
**الإصلاح:** `sync.mjs` دلوقتي يبني مجموعة أكواد الكتالوج ويتخطّى أي كود مش موجود فيها
(يُدار بالـseed المنفصل)، مع log واضح. **النتيجة المؤكَّدة:** `0 successful; 0 failed`
والـsync-runner سجّل `status: success · exitCode: 0` — البانر الأحمر يختفي.

---

# الجولة التاسعة — الأمان الأساسي + منطق الحصص (كلها سليمة ✅)

فحص الطبقات الأمنية والأساسية المتبقية — **مفيش بَقات جديدة**:

- **`auth.ts`** ✅: توكن جلسة 256-bit مخزّن كـsha256، كوكي httpOnly+sameSite:strict+secure،
  rate limit 5/15د مع حماية من timing/enumeration (dummy hash)، تدوير الجلسة، lockdown للسوبر أدمن.
  (ملاحظة housekeeping بسيطة: مفيش تنظيف دوري للجلسات المنتهية/محاولات الدخول القديمة.)
- **`password.ts`** ✅: scrypt + salt عشوائي + `timingSafeEqual`. قوي وصحيح.
- **`team.ts` (الحصص)** ✅: `consumeSearch` فيه `FOR UPDATE` lock (آمن من السباق/TOCTOU)،
  dedup يمنع الخصم المزدوج، فحص allowed قبل الإدراج، `member_limit` مفحوص (admin only).
- **`decisions.ts`** ✅: role gate + تحقق enum + سبب إلزامي + قيد "المنشئ فقط" + append-only + audit + tenant-scoped.
- **`schedule-config.ts` (PLIST)** ✅: القيم أرقام/ثوابت/مسارات سيرفر + `execFile` (مش shell) → مفيش حقن XML/command.

## الحالة الإجمالية لمراجعة V2 (9 جولات)
- **البيانات:** 60/60 مصدر فيه داتا · 311,860 سجل · البحث يطلّع تقارير صح (متأكَّد).
- **الكود:** كل البَقات الفعلية اتصلّحت (A–V, Z, W/W2/W3 + توصيات). الطبقات الأمنية سليمة.
- **الجودة:** `tsc` 0 أخطاء · `next build` نجح · 60/60 اختبار.

---

# الجولة العاشرة — Housekeeping + بوابة SAR/OCR المدفوعة

## #1 ✅ تنظيف دوري للجلسات/محاولات الدخول
`auth.ts` (`createSession`): بعد نجاح الدخول (عملية نادرة) بيحذف الجلسات المنتهية
(`expires_at < now()`) ومحاولات الدخول القديمة (خارج نافذة الـ15 دقيقة). الجداول مش
هتكبر بلا حدود. fire-safe (في try/catch، مايعطّلش الدخول).

## #2 ✅ SAR و OCR بقوا مزايا مدفوعة (feature-gated)
اتضاف feature key-ين جديدين: `goaml_filing` و `document_ocr`، والبوابة اتطبّقت على كل المسارات:
- **SAR/goAML:** صفحة `/profiles/[id]/sar` (FeatureLocked) + `POST /api/profiles/[id]/sar`
  (403) + `GET /api/profiles/[id]/sar-export` (403) + لينكات SAR/REAR في صفحة الملف (مخفية).
- **OCR:** `POST /api/ocr/scan` (403) + مكوّن `IdOcrScanner` في نموذج العميل (مخفي عبر `canUseOcr`).
- **لوحة /platform:** اتضاف الميزتين لـFEATURE_META ولباقات base/pro/enterprise (المالك يتحكم فيهم لكل مؤسسة).
- المؤسسات الحالية اتفعّلهم الميزتين في القاعدة عشان الوصول مايتعطّلش.
التأكيد: `tsc` 0 · `build` نجح · 60/60 اختبار · `hasFeature` متأكّد (base بدون→مرفوض، enterprise/مع→مسموح).

## #3 ⚠️ goAML XSD — محتاج جداول الأكواد الرسمية (مش قابل للإكمال هنا)
الـXML دلوقتي سليم بنيويًا (تواريخ xs:dateTime، escape للرموز) لكن `report_code` و`indicator`
بيستخدموا أكواد التطبيق الداخلية. التحويل لأكواد goAML الرسمية + التحقق مقابل `goAML.xsd`
الإنتاجي **محتاج جداول الأكواد والـschema الصادرة من وحدة المعلومات المالية الإماراتية** —
مش متوفرة عندي، فمش ممكن أكملها دلوقتي. (اتحطّت ملاحظة JSDoc صريحة فوق `generateGoAmlXml`
تحذّر من ده قبل أي تقديم فعلي.) لما تجيب الجداول، أقدر أعمل طبقة mapping وأوصّلها بسهولة.

---

# الجولة الحادية عشرة — منطق الـcore المتبقي (كله سليم ✅)

- **`customers.ts`** ✅: create/update (role gate + قيد المنشئ + audit + تتبّع تغيّر الهوية)،
  delete (admin فقط + تنظيف children + cascade لجداول V2)، و`enrichCustomerFromMatch` بيملأ
  **الحقول الفاضية فقط** (مابيكتبش فوق داتا صحيحة، أعمدة ثابتة = مفيش SQL injection).
- **`platform.ts` (لقداون + سوبر أدمن)** ✅: `toggleSystemLockdownAction`/`quickReenableSystemAction`
  بيفرضوا `isPlatformOwner`؛ `superAdminCreditUserQuota` بيفرضها داخليًا. قفل النظام مؤمّن.
- **`review-cases.ts`** ✅: `orderBy` whitelist (مفيش حقن)، فلاتر parameterized، role gate على الإسناد، tenant-scoped.

## ملاحظتان (اعتبارات، مش بَقات)
1. **احتفاظ ببلاغات SAR:** حذف العميل بيحذف بلاغات SAR بتاعته (cascade). الجهات الرقابية
   غالبًا بتطلب الاحتفاظ بالبلاغات لـ5 سنين حتى بعد حذف العميل — اعتبار قانوني/منتج.
2. **Defense-in-depth:** `setSystemLockdown`/`updateOrgPlan` بيعتمدوا على فحص الـaction
   لـisPlatformOwner (آمن حاليًا لأنهم بيتنادوا من actions مغلّقة بس). إضافة فحص داخلي
   فيهم يقوّي الحماية لو اتنادوا من مكان جديد مستقبلًا.

## الحالة الإجمالية (11 جولة فحص)
V2 اتفحص بعمق: core/screening/data/security/connectors/sync/API/actions/feature-gating.
كل البَقات الفعلية اتصلّحت. `tsc` 0 · `build` نجح · 60/60 اختبار · 60/60 مصدر بيانات.

---

# الجولة الثانية عشرة — احتفاظ SAR + scaffold أكواد goAML

## (أ) ✅ احتفاظ ببلاغات SAR (متطلب قانوني — 5 سنين)
`db/026_sar_retention.sql` (موصول في setup-db): غيّر FK `customer_id` في `customer_sar_reports`
من `ON DELETE CASCADE` → `ON DELETE SET NULL` وخلّى العمود nullable. البلاغ أصلًا بيخزّن
snapshot كامل للعميل، فحذف العميل دلوقتي **يحتفظ بالبلاغ** ويشيل الربط بس.
**مُختبَر end-to-end:** بعد حذف العميل → البلاغ موجود، `customer_id=null`، والـsnapshot محفوظ.
(+ index للبلاغات المحتفَظ بها بعد حذف عميلها، للعرض الرقابي.)

## (ب) ✅ scaffold أكواد goAML (جاهز للأكواد الرسمية)
`src/lib/goaml-codes.ts` جديد: خرائط فاضية (`REPORT_CODE_MAP`, `INDICATOR_CODE_MAP`) +
`GOAML_SCHEMA_VERSION` + دوال `toGoAmlReportCode`/`toGoAmlIndicator` (fallback للأكواد الداخلية
لو مش متعبّية) + `isGoAmlMappingComplete()` + تعليمات تفعيل التحقق من XSD. `generateGoAmlXml`
اتوصّل بالخرائط (سلوك حالي محفوظ لحد ما تتعبّى الأكواد الرسمية).
**الخطوة المتبقية (إنت):** سجّل الكيان على goAML (وزارة الاقتصاد للـDNFBP / المركزي للمؤسسات
المالية) → نزّل goAML.xsd وجداول الأكواد → عبّي الخرائط وفعّل التحقق.

التأكيد: `tsc` 0 · `build` نجح · 60/60 اختبار.

---

# الجولة الثالثة عشرة — ربط المراقبة بالجدولة + تصحيح

## ✅ المراقبة المستمرة بقت تشتغل تلقائيًا مع كل مزامنة
- دالة مشتركة `runAllOrgsMonitoring()` في `ongoing-monitoring.ts` (اكتشاف المؤسسات
  عبر withPlatformOwner + دورة لكل مؤسسة حسب خطتها).
- `/api/cron/monitoring` اتعاد استخدامها بالدالة دي (مفيش تكرار).
- سكربت مستقل `scripts/run-monitoring.ts` (يحمّل env قبل الـpool، يشتغل عبر tsx).
- `scripts/sync-cron.sh` بقى يشغّل المراقبة **بعد** كل مزامنة مصادر → فلما تظبط الجدولة
  من لوحة الأدمن (اللي بتكتب crontab على Linux)، المصادر + المراقبة الاتنين بيشتغلوا تلقائيًا.
**مُختبَر:** السكربت لقى المؤسسة ونفّذ (scanned 0 لأن المؤسسة مالهاش ميزة المراقبة — الـgating شغّال).

## 🔧 تصحيح finding Y (كان غلط)
`schedule-config.ts` **فيه مسار crontab لـLinux** (سطر 172+) — فالجدولة على الـVPS بتتكتب
**تلقائيًا** من لوحة الأدمن، مش محتاجة cron يدوي. (كنت افتكرت launchd بس = macOS.) فالجدولة
التلقائية للمصادر **والمراقبة** شغّالة على Linux من غير أي تدخّل يدوي.

التأكيد: `tsc` 0 · `build` نجح · 60/60 اختبار.
