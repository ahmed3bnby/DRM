# رفع V2 على Vercel (نسخة ديمو بداتا مختصرة)

> مشروع Vercel **جديد** منفصل عن مشروع `drm` (V1) — نفس الـrepo، فرع `v2-enterprise`.
> الداتا: 35 قائمة أساسية (عقوبات + الإمارات/الخليج + PEP + مطلوبين + حظر) ≈ 58 ألف سجل — **220MB** تدخل في Neon المجاني (0.5GB).

## 1) إنشاء المشروع على Vercel
1. **Add New → Project** → اختار repo **ahmed3bnby/DRM** → Import.
2. **Project Name:** اسم محايد مثل `abc-compliance` (الرابط هيبقى `abc-compliance.vercel.app` — من غير DRM).
3. Framework: Next.js (تلقائي). ماتغيّرش أوامر الـbuild.
4. اضغط **Deploy** — أول deploy هيكون من `main` (V1) وهيفشل أو يطلع V1، **عادي**.
5. **Settings → Environments → Production → Branch Tracking** → غيّر الفرع لـ **`v2-enterprise`** → Save.

## 2) قاعدة البيانات (Neon مجاني)
1. في المشروع الجديد: **Storage → Create Database → Neon** → Free → اربطها بالمشروع.
2. ⚠️ لو سألك عن **Environment Variables Prefix** اكتب: `NEON` (عشان المتغير `DATABASE_URL` يفضل فاضي لينا).
3. من صفحة الداتابيز (أو Neon Console → Connection Details) انسخ **رابط الـowner الـunpooled** (فيه `neondb_owner` ومن غير `-pooler`).

## 3) تجهيز الداتابيز من جهازك (أمر واحد)
اعمل ملف `.env.neon` في فولدر المشروع (متجاهَل من git):
```
NEON_OWNER_URL=postgres://neondb_owner:...@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require
APP_DB_PASSWORD=<باسورد جديد قوي 16+ حرف وأرقام — لدور التطبيق المحدود>
DEMO_PASSWORD=<باسورد حساب demo@mizan.test — 12+ حرف>
```
وبعدين:
```bash
bash scripts/deploy-neon.sh
```
بيعمل: الجداول + دور التطبيق المحدود `mizan_app` + المؤسسة والمستخدمين + نسخ الـ35 قائمة + حسابك السوبر أدمن (بنفس باسوردك) + **يتأكد إن دور التطبيق مايقدرش يتخطى عزل المؤسسات (RLS)**.

## 4) متغيرات البيئة على Vercel
**Settings → Environment Variables** (Production):

| الاسم | القيمة |
|---|---|
| `APP_DATABASE_URL` | نفس رابط الـowner بس **اليوزر `mizan_app`** والباسورد = `APP_DB_PASSWORD` (Neon بيحط `DATABASE_URL` بتاع الـowner لوحده — التطبيق بيتجاهله ومش بيشتغل من غير `APP_DATABASE_URL`) |
| `APP_ENV` | `production` |
| `APP_ORIGIN` | `https://abc-compliance.vercel.app` (رابط مشروعك) |
| `CRON_SECRET` | أي نص عشوائي طويل (للمراقبة اليومية) |

> 🔴 **ماتحطش رابط الـowner في `APP_DATABASE_URL`** — الـowner في Neon عنده `BYPASSRLS`، يعني أي مؤسسة هتشوف بيانات التانية.

بعدها: **Deployments → آخر deploy من `v2-enterprise` → Redeploy**.

## 5) الدخول
- السوبر أدمن: إيميلك + باسوردك الحالي.
- الديمو: `demo@mizan.test` + `DEMO_PASSWORD`.

## اللي مش هيشتغل على Vercel (بالتصميم)
| الميزة | السبب | البديل |
|---|---|---|
| زر "سحب تحديثات المصادر الآن" + جدولة السحب | سكربتات Python وcron ومافيش ديسك قابل للكتابة | بيظهر تنبيه واضح. الداتا ثابتة (snapshot) — لتحديثها شغّل `bash scripts/deploy-neon.sh` تاني |
| فحص الداتا الكاملة (60 قائمة) | حجم 1.2GB | Neon مدفوع، أو السيرفر |

✅ شغّال: البحث، إنشاء وفحص العملاء، التقارير، المراجعات، التحليلات، SAR/goAML، المسح الضوئي (OCR — ملف اللغة جوه المشروع)، المراقبة المستمرة (cron يومي 04:30 بتوقيت الإمارات عبر `vercel.json`).

## ملاحظات
- **Vercel Hobby مخصص للاستخدام غير التجاري** — لعرض على عميل/استخدام تجاري الشروط بتطلب Pro.
- مشروع `drm` القديم عليه ⏸ (متوقف) — ده سبب ظهور معاينة `v2-enterprise` كـ **Blocked** فيه؛ المشروع الجديد مش متأثر.
