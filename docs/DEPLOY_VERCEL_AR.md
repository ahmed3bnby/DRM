# النشر على Vercel + Neon (مجانًا للتجربة)

دليل عملي لتشغيل المنصة على **Vercel** (التطبيق) + **Neon** (قاعدة PostgreSQL). كله مجاني للتجربة.

> ملاحظات أساسية:
> - **الـPython/المزامنة مش بتشتغل على Vercel.** بتستورد القوائم مرة واحدة من جهازك إلى Neon، والتطبيق بيقرأ القاعدة بس.
> - **الحد المجاني في Neon ≈ 0.5 جيجا.** عشان كده بنستورد **قوائم أساسية مصغّرة** (مش كل الـ48).
> - محتاج على جهازك: Node 20+، Python 3، وحساب GitHub.

---

## ١) إنشاء قاعدة Neon

1. اعمل حساب على [neon.tech](https://neon.tech) → **New Project** (اختَر أقرب Region).
2. من صفحة المشروع، هتلاقي **Connection string**. خُد نسختين:
   - **Direct** (من غير `-pooler`) → للإعداد والاستيراد من جهازك.
   - **Pooled** (فيه `-pooler`) → لتشغيل التطبيق على Vercel.
   كلاهما لازم ينتهي بـ `?sslmode=require`.

مثال الشكل:
```
# Direct  (owner) — للإعداد
postgresql://<owner>:<pass>@ep-xxx.<region>.aws.neon.tech/<db>?sslmode=require
# Pooled  (owner) — نفس البيانات بس بـ -pooler
postgresql://<owner>:<pass>@ep-xxx-pooler.<region>.aws.neon.tech/<db>?sslmode=require
```

---

## ٢) تجهيز متغيرات البيئة محليًا

اعمل ملف `.env.production.local` في جذر المشروع (متبعتوش لـGit):

```bash
APP_ENV=local
ALLOW_REMOTE_DB_SETUP=1
DEMO_PASSWORD=اختر-كلمة-قوية-١٢-حرف-على-الأقل

# دور المالك (Direct) — للإعداد والاستيراد
DATABASE_ADMIN_URL=postgresql://<owner>:<pass>@ep-xxx.<region>.aws.neon.tech/<db>?sslmode=require

# دور التطبيق mizan_app — إنت بتختار كلمة سرّه هنا، والإعداد بينشئه بيها.
# استخدم مضيف Neon نفسه (Direct هنا للإعداد).
DATABASE_URL=postgresql://mizan_app:<كلمة-سر-التطبيق>@ep-xxx.<region>.aws.neon.tech/<db>?sslmode=require
```

`setup-db` بيقرأ كلمة سر `mizan_app` من `DATABASE_URL` وبينشئ الدور بيها تلقائيًا.

---

## ٣) إنشاء الجداول + الأدوار + بيانات تجريبية على Neon

```bash
node --env-file=.env.production.local --import tsx scripts/setup-db.ts
```

ده بيعمل: امتداد `pg_trgm` + دور `mizan_app` + كل الـmigrations + مؤسّستين + مستخدمين تجريبيين + عملاء نموذجيين. الدخول بعدين بـ `demo@mizan.test` وكلمة `DEMO_PASSWORD`.

---

## ٤) استيراد القوائم (نسخة مصغّرة تدخل في الحد المجاني)

```bash
# أ) حدّث فهرس المصادر
python3 scripts/connectors/opensanctions.py catalog

# ب) نزّل القوائم الأساسية
python3 scripts/connectors/opensanctions.py \
  us_ofac_sdn us_ofac_cons eu_fsf gb_fcdo_sanctions un_sc_sanctions \
  ae_local_terrorists sa_pcct_terrorism_list ch_seco_sanctions \
  us_trade_csl eg_terrorists

# ج) استوردها إلى Neon
node --env-file=.env.production.local --import tsx scripts/import-sources.ts \
  us_ofac_sdn us_ofac_cons eu_fsf gb_fcdo_sanctions un_sc_sanctions \
  ae_local_terrorists sa_pcct_terrorism_list ch_seco_sanctions \
  us_trade_csl eg_terrorists
```

> عايز تغطية أكبر؟ زوّد أكواد من `scripts/watchlist.json`. راقب حجم القاعدة في لوحة Neon؛ لو قرّب من 0.5 جيجا، سيب القوائم الضخمة (زي `everypolitician`) لبعد ما تنقل لـVPS.

راجع الاستيراد:
```bash
node --env-file=.env.production.local -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_ADMIN_URL,ssl:{rejectUnauthorized:false}});p.query('SELECT count(*) lists,sum(record_count) recs FROM source_versions WHERE active').then(r=>{console.log(r.rows[0]);p.end()})"
```

---

## ٥) رفع الكود على GitHub

```bash
git init && git add -A && git commit -m "Deploy: DRM compliance platform"
# اربطه بريبو خاص على GitHub وادفعه
```
تأكد إن `.env*.local` مُستثناة في `.gitignore` (مفيش أسرار تترفع).

---

## ٦) النشر على Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → اختَر الريبو. (Vercel هيكتشف Next.js لوحده — مفيش إعداد بناء إضافي).
2. قبل الـDeploy، من **Environment Variables** ضيف:

| المتغير | القيمة |
|---|---|
| `DATABASE_URL` | سلسلة **mizan_app** بمضيف **Pooled** (`-pooler`) + `?sslmode=require` |
| `APP_ORIGIN` | `https://your-app.vercel.app` (أو دومينك) |
| `PLATFORM_ADMIN_USER_IDS` | UUID حساب الأدمن بتاعك (تجيبه في الخطوة ٧) |

> **مهم:** متضفش `APP_ENV` ولا `APP_RESTRICT_LOCALHOST` على Vercel — لو ضفتهم هيقفلوا الموقع على localhost.

3. **Deploy**. بعد ما يخلص، افتح الرابط وسجّل دخول بـ `demo@mizan.test`.

---

## ٧) تفعيل صفحة الإدارة (اختياري)

```bash
node --env-file=.env.production.local -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_ADMIN_URL,ssl:{rejectUnauthorized:false}});p.query(\"SELECT id,email FROM users WHERE role='admin'\").then(r=>{console.table(r.rows);p.end()})"
```
خُد الـUUID، حطّه في `PLATFORM_ADMIN_USER_IDS` على Vercel، واعمل **Redeploy**.

---

## ٨) دومين مخصّص (اختياري)

Vercel → المشروع → **Settings → Domains** → أضف دومينك واتبع تعليمات DNS. الـHTTPS بيتفعّل تلقائيًا. بعد الربط، عدّل `APP_ORIGIN` لدومينك واعمل Redeploy.

---

## حدود التجربة المجانية (طبيعية)
- Neon بينام بعد ٥ دقايق خمول → أول طلب بعد الخمول بطيء ثانية (Cold start).
- تخزين 0.5 جيجا → قوائم مصغّرة.
- **المزامنة التلقائية للقوائم مش شغّالة** — بتحدّث يدويًا بإعادة خطوة ٤.

## لمّا تنقل لـVPS
نفس الكود بالظبط — بتحرّك القاعدة لـPostgres على الـVPS، تستورد كل الـ48 قائمة، وتفعّل الجدولة التلقائية (`scripts/install-schedule.sh`). مفيش تغيير في الكود.
