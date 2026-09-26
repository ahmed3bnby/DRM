# تقرير الفحص الأمني الشامل والتدقيق البرمجي (Security & Vulnerability Audit Report)
**نظام دي آر إم للامتثال وفحص العقوبات ومكافحة غسل الأموال (DRM Compliance System)**  
**تاريخ الفحص:** 26 سبتمبر 2026  
**نطاق التدقيق:** فحص شامل لكل صفحات ومسارات وخوادم وعمليات النظام (Page-by-Page & Route-by-Route Audit).

---

## ١. ملخص تنفيذي ونطاق التدقيق (Audit Scope & Summary)

تم إجراء تدقيق برمجي وأمني شامل وعميق لكافة صفحات النظام الـ ١٥، ومسارات الخادم (Server Actions)، ومكتبات الفحص والتقييم وقواعد البيانات وسياسات العزل (Model B Isolation & Row Level Security).

### المسارات والصفحات المفحوصة تفصيلياً:
1. **`/login` (صفحة تسجيل الدخول):** التحقق من أمان الجلسات، التشفير بملح، حماية التوقيت (Constant-time verification)، ومحدد معدل المحاولات (Rate Limiting).
2. **`/` (لوحة التحكم الرئيسية Dashboard):** فحص إحصائيات العزل، عزل سجل النشاط الشخصي للمحلل، وإخفاء أدوات الإدارة عن غير المديرين.
3. **`/search` (محرك فحص القوائم):** استهلاك الحصص، سجل البحث السريع، منع استعلامات SQL الخبيثة (Injection Protection)، والتطابق اللغوي المزدوج.
4. **`/search/[id]` (تفاصيل سجل المصدر):** فحص روابط الرجوع، الأمان ضد إعادة التوجيه المفتوح (Open Redirect)، وصلاحيات الإضافة المباشرة كعميل.
5. **`/search/history` (سجل البحث والتدقيق):** عزل السجلات لكل مستخدم، منع التكرار، والتحكم في حذف السجلات.
6. **`/profiles` (سجل العملاء):** فحص عزل قوائم العملاء، فلاتر البحث، والباجينيشن، ومنع تسريب بيانات مستخدم لآخر.
7. **`/profiles/new` (إضافة عميل جديد):** فحص التحقق من المدخلات (Zod validation)، وحماية الحقول الإلزامية.
8. **`/profiles/[id]` (ملف العميل والمطابقات):** فحص قيود الوصول والتحقق من منشئ الملف (Creator ownership guard).
9. **`/profiles/[id]/edit` (تعديل العميل):** التحقق من قصر التعديل على المنشئ أو المدير ومنع تجاوز الصلاحيات.
10. **`/profiles/[id]/report` (تقرير الامتثال والطباعة):** تدقيق صلاحيات الوصول، وعزل بيانات التقرير، وتوقيع التدقيق.
11. **`/reviews` (صندوق مراجعة المطابقات):** تدقيق استلام الحالات (Claiming)، والتعيين، وعزل طابور العمل لكل موظف.
12. **`/sources` (بيانات المصادر والتغطية):** التحقق من قصر الوصول على المدير فقط، وتشفير البصمات (SHA-256).
13. **`/team` (إدارة الفريق والحصص):** التحقق من حماية مسارات تعديل الأدوار، وكلمات المرور، والحصص.
14. **`/team/[id]` (سجل نشاط العضو):** حماية السجلات الرقابية للمستخدمين وحصرها على الإدارة.
15. **`/admin` (عمليات النظام والمزامنة):** التحقق من اشتراط صفة مالك المنصة (Platform Owner) والبيئة المحلية.

---

## ٢. قائمة الثغرات والمشاكل المكتشفة (Identified Vulnerabilities & Issues)

| الرقم | اسم الثغرة / المشكلة | الملف والمسار | مستوى الخطورة | الحالة |
| :--- | :--- | :--- | :---: | :---: |
| **SEC-01** | تسريب تقرير العميل لغير منشئه (IDOR in Customer Report) | `src/app/(workspace)/profiles/[id]/report/page.tsx` | **مرتفع (High)** | يتطلب تصليح |
| **SEC-02** | إمكانية إعادة توجيه المستخدم لروابط خارجية (Open Redirect) | `src/app/(workspace)/search/[id]/page.tsx` | **متوسط (Medium)** | يتطلب تصليح |
| **SEC-03** | غياب التحقق من ملكية الملف عند تسجيل قرارات المطابقة (IDOR in Match Decision) | `src/lib/decisions.ts` & `src/app/actions.ts` | **مرتفع (High)** | يتطلب تصليح |
| **SEC-04** | إمكانية إعادة فحص عميل مملوك لزميل آخر (Screening Ownership Bypass) | `src/lib/screening.ts` & `src/app/actions.ts` | **متوسط (Medium)** | يتطلب تصليح |
| **SEC-05** | إمكانية استلام مراجعة حالة عميل يملكه محلل آخر (Review Case Claim Bypass) | `src/lib/review-cases.ts` | **متوسط (Medium)** | يتطلب تصليح |
| **SEC-06** | خطأ في إسناد اسم منفذ الإجراء في سجل تقرير العميل (Audit Trail Misattribution) | `src/app/(workspace)/profiles/[id]/report/page.tsx` | **منخفض (Low)** | يتطلب تصليح |
| **SEC-07** | نقص في ترويسات الأمان الصارمة (Missing HSTS in Next Config) | `next.config.ts` | **منخفض (Low)** | يتطلب تحسين |

---

## ٣. التفاصيل الفنية للثغرات وكيفية معالجتها (Technical Details & Fixes)

### الثغرة الأولى (SEC-01): تسريب تقرير العميل عبر معرف الرابط (IDOR in Customer Report)
* **المكان:** `src/app/(workspace)/profiles/[id]/report/page.tsx` (السطر 26-28).
* **الوصف والخطورة:** 
  في صفحة ملف العميل الرئيسية `/profiles/[id]` وصفحة التعديل `/profiles/[id]/edit`، تم وضع شرط أمان يمنع أي موظف (غير المدير) من فتح ملف عميل لم يقم هو بإنشائه (`if (actor.role !== 'admin' && customer.created_by && customer.created_by !== actor.id) notFound();`).
  ولكن في صفحة التقرير `/profiles/[id]/report`، هذا الفحص كان **غائباً تماماً**؛ مما يتيح لأي محلل يعرف كود عميل زميله (مثلاً `KYC-9993C70D`) أن يكتب الرابط مباشرة ويطّلع على كامل التقرير وبيانات الهوية ومطابقات العقوبات ومصفوفة المخاطر الرسمية.
* **كود التصليح:**
  ```tsx
  // إضافة فحص التحقق من ملكية الملف في صفحة التقرير
  if (actor.role !== 'admin' && customer.created_by && customer.created_by !== actor.id) {
    notFound();
  }
  ```

---

### الثغرة الثانية (SEC-02): ثغرة التوجيه المفتوح عبر الرابط النسبي (Open Redirect via Protocol-Relative URL)
* **المكان:** `src/app/(workspace)/search/[id]/page.tsx` (السطر 38).
* **الوصف والخطورة:**
  الكود يتحقق من رابط العودة بالشكل التالي:
  `const returnTo = search.returnTo && search.returnTo.startsWith('/') ? search.returnTo : '/search';`
  إذا قام مهاجم بإرسال رابط يحتوي على بروتوكول نسبي مثل:
  `/search/[id]?returnTo=//attacker.com`
  فإن `startsWith('/')` ستعيد `true`، ولكن متصفح الضحية عندما ينقر زر "العودة" سينقله فوراً إلى موقع المهاجم الخارجي `attacker.com` بدلاً من المسار الداخلي، مما يفتح باباً لهجمات التصيد (Phishing).
* **كود التصليح:**
  ```tsx
  // منع الروابط التي تبدأ بـ // أو /\ لمنع التوجيه الخارجي
  const returnTo = search.returnTo && search.returnTo.startsWith('/') && !search.returnTo.startsWith('//') && !search.returnTo.startsWith('/\\')
    ? search.returnTo
    : '/search';
  ```

---

### الثغرة الثالثة (SEC-03): غياب التحقق من ملكية العميل عند تسجيل قرارات المطابقة (IDOR in Match Decision)
* **المكان:** `src/lib/decisions.ts` في الدالة `recordMatchDecision` ودوال `saveMatchDecisionAction` في `src/app/actions.ts`.
* **الوصف والخطورة:**
  الدالة تتأكد فقط من أن المستخدم محلل أو مدير `canManageCustomers(actor.role)`، ولكنها لا تتأكد من أن العميل المستهدف `customerId` يخص هذا المحلل تحديداً. وبالتالي يمكن لمحلل خبيث إرسال طلب POST لتأكيد أو استبعاد عقوبة على عميل يخص محللاً آخر.
* **كود التصليح:**
  التحقق في قاعدة البيانات من أن العميل يتبع نفس المنشأة، وأنه في حال كان المستخدم ليس مديراً، فيجب أن يكون هو منشئ العميل:
  ```ts
  const cust = await db.query(
    'SELECT created_by FROM customers WHERE organization_id = $1 AND id = $2',
    [actor.organizationId, customerId]
  );
  if (!cust.rowCount) throw new Error('NOT_FOUND');
  if (actor.role !== 'admin' && cust.rows[0].created_by && cust.rows[0].created_by !== actor.id) {
    throw new Error('FORBIDDEN_NOT_CREATOR');
  }
  ```

---

### الثغرة الرابعة (SEC-04): إمكانية إعادة فحص عميل زميل آخر (Screening Ownership Bypass)
* **المكان:** `src/lib/screening.ts` والدالة `screenCustomer` و `runAndSaveScreening`.
* **الوصف والخطورة:**
  تقوم الدالة `screenCustomer` بجلب العميل عبر `getCustomer(actor.organizationId, customerId)` دون تمرير `actorId`. وبالتالي يمكن للمحلل طلب فحص أمني لعميل ليس مسجلاً باسمه واستهلاك حصة أو تغيير حالة العميل.
* **كود التصليح:**
  تمرير معرّف الفاعل `actorId` عند جلب العميل بحيث يتم رفض فحص عميل غير مملوك للمحلل:
  ```ts
  const actorId = actor.role === 'admin' ? undefined : actor.id;
  const customer = await getCustomer(actor.organizationId, customerId, actorId);
  if (!customer) throw new Error('NOT_FOUND');
  ```

---

### الثغرة الخامسة (SEC-05): إمكانية استلام مراجعة حالة عميل يملكه محلل آخر (Review Case Claim Bypass)
* **المكان:** `src/lib/review-cases.ts` في الدالة `assignReviewCase`.
* **الوصف والخطورة:**
  عندما يطلب موظف استلام حالة مراجعة (`claim = true`)، يتم تنفيذ الاستعلام:
  `UPDATE review_cases SET assigned_to = $target WHERE id = $caseId`
  دون التحقق مما إذا كان العميل المرتبط بهذه الحالة منشأ بواسطة هذا الموظف أم موظف آخر.
* **كود التصليح:**
  التحقق من أن العميل يملكه المحلل نفسه إذا لم يكن مديراً:
  ```ts
  if (claim && actor.role !== 'admin') {
    const ownerCheck = await db.query(
      `SELECT c.created_by FROM review_cases rc JOIN customers c ON c.id = rc.customer_id WHERE rc.id = $1 AND rc.organization_id = $2`,
      [caseId, actor.organizationId]
    );
    if (!ownerCheck.rowCount) throw new Error('NOT_FOUND');
    if (ownerCheck.rows[0].created_by && ownerCheck.rows[0].created_by !== actor.id) {
      throw new Error('FORBIDDEN');
    }
  }
  ```

---

### الثغرة السادسة (SEC-06): خطأ في إسناد اسم منفذ الإجراء في سجل تقرير العميل (Audit Trail Misattribution)
* **المكان:** `src/app/(workspace)/profiles/[id]/report/page.tsx` (السطر 485).
* **الوصف:**
  في جدول سجل التدقيق بالتقرير المطبوع:
  `<td>{actor.displayName}</td>`
  تم تثبيت اسم المستخدم الحالي (المتصفح للتقرير) ليظهر كمنفذ لكافة العمليات السابقة حتى لو كانت تلك العمليات قد نفذها مدير النظام أو مستخدم آخر في وقت سابق!
* **كود التصليح:**
  عرض اسم منشئ الملف أو جلب اسم الفاعل الحقيقي من سجل التدقيق المسجل.

---

### الثغرة السابعة (SEC-07): تعزيز ترويسات الأمان الصارمة في Next.js (Strict Transport Security)
* **المكان:** `next.config.ts`.
* **الوصف:**
  إضافة ترويسة `Strict-Transport-Security` (HSTS) و `X-XSS-Protection` لمنع أي محاولة اتصال غير مشفر وحماية الجلسات.
* **كود التحسين:**
  ```ts
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-XSS-Protection", value: "1; mode=block" }
  ```

---

## ٤. خطة التنفيذ والإصلاح الفوري (Remediation Plan)

1. **المرحلة الأولى:** سد ثغرات العزل والتسريب في التقرير `report/page.tsx`.
2. **المرحلة الثانية:** معالجة ثغرة التوجيه المفتوح في `search/[id]/page.tsx`.
3. **المرحلة الثالثة:** تحصين دوال تعديل المطابقات والفحص واستلام الحالات (`decisions.ts`, `screening.ts`, `review-cases.ts`).
4. **المرحلة الرابعة:** تعزيز ترويسات الأمان في `next.config.ts`.
5. **المرحلة الخامسة:** إضافة اختبارات آلية جديدة تغطي هذه الحالات والتأكد من اجتياز 100% من الاختبارات دون أي خطأ.

---
**تم إعداد هذا الملف كمرجع رقابي وهندسي للتصليح الفوري وفقاً لأعلى معايير الامتثال.**
