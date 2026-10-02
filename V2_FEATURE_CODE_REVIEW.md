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

