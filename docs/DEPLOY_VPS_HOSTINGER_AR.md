# النشر على Hostinger VPS (Ubuntu)

دليل كامل لتشغيل المنصة على VPS — كل حاجة في مكان واحد: التطبيق + PostgreSQL + المزامنة التلقائية + كل القوائم. ده الإعداد الأمثل (أفضل من Vercel لهذا التطبيق).

> **مزايا الـVPS:** المزامنة التلقائية تشتغل · كل الـ48 قائمة · التطبيق يتصل بدور `mizan_app` محدود الصلاحية (أأمن) · تحكّم كامل.

الأوامر دي بتتنفّذ عبر SSH كـ`root` (Hostinger بيديك IP + كلمة سر root).

---

## ١) تجهيز السيرفر

```bash
apt update && apt upgrade -y
apt install -y git nginx python3 ufw
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

**Node.js 20:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # لازم يطلع v20+
```

**PostgreSQL:**
```bash
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql
```

---

## ٢) قاعدة البيانات + الأدوار

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE drm;
-- دور التطبيق محدود الصلاحية (setup-db بيكمّل إعداده وبيحط كلمة السر)
-- بنكتفي هنا بإنشائه؛ الصلاحيات بتتظبط في الـmigrations
SQL
```
> `mizan_app` بينشئه سكربت الإعداد تلقائيًا. الدور الإداري للإعداد هو `postgres` (superuser، محتاجينه لتفعيل امتداد `pg_trgm`).

---

## ٣) جلب الكود والبناء

```bash
git clone https://github.com/ahmed3bnby/DRM.git /var/www/drm
cd /var/www/drm
npm install
npm run build
```

---

## ٤) متغيرات البيئة

اعمل ملف `/var/www/drm/.env.production.local`:
```bash
# للتشغيل (Runtime)
DATABASE_URL=postgresql://mizan_app:APP_PASS_STRONG@localhost:5432/drm
APP_ORIGIN=https://your-domain.com
PLATFORM_ADMIN_USER_IDS=97e80963-ec89-4e76-9807-26ae85f7d659
NODE_ENV=production

# للإعداد والاستيراد (تشتغل مرة على السيرفر — DB محلي فمفيش داعي لـALLOW_REMOTE)
APP_ENV=local
DATABASE_ADMIN_URL=postgresql://postgres:POSTGRES_PASS@localhost:5432/drm
DEMO_PASSWORD=اختر-كلمة-١٢-حرف
```
> غيّر `APP_PASS_STRONG` (كلمة سر `mizan_app`) و`POSTGRES_PASS` (كلمة سر postgres — تظبطها بـ`sudo -u postgres psql -c "ALTER USER postgres PASSWORD '...';"`) و`your-domain.com`.
>
> ⚠️ **مهم:** متحطّش `APP_RESTRICT_LOCALHOST`.

---

## ٥) إنشاء الجداول + البيانات

```bash
cd /var/www/drm
node --env-file=.env.production.local --import tsx scripts/setup-db.ts
```
ده بينشئ `pg_trgm` + دور `mizan_app` + كل الـmigrations (لحد 018) + مؤسّسات + مستخدمين تجريبيين.

**حسابك الأدمن + المؤسسة DRM** (نفس السكربت اللي عملناه):
```bash
# غيّر اسم المؤسسة + اعمل حسابك — أو استخدم لوحة /platform بعدين
```

---

## ٦) استيراد القوائم (كلها — فيه مساحة على الـVPS)

```bash
python3 scripts/connectors/opensanctions.py catalog
python3 scripts/connectors/opensanctions.py $(node -e "console.log(require('./scripts/watchlist.json').datasets.join(' '))")
node --env-file=.env.production.local --import tsx scripts/import-sources.ts $(node -e "console.log(require('./scripts/watchlist.json').datasets.join(' '))")
```

---

## ٧) تشغيل التطبيق (PM2)

```bash
npm install -g pm2
cd /var/www/drm
pm2 start "npm run start" --name drm
pm2 save
pm2 startup    # اتبع السطر اللي بيطلعه عشان يشتغل عند إعادة التشغيل
```
التطبيق دلوقتي شغّال على `localhost:3000`.

---

## ٨) Nginx + HTTPS

```bash
cat > /etc/nginx/sites-available/drm <<'NGINX'
server {
  listen 80;
  server_name your-domain.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/drm /etc/nginx/sites-enabled/drm
nginx -t && systemctl reload nginx

# HTTPS مجاني
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```
> وجّه الدومين (A record) لـIP السيرفر قبل خطوة certbot.

---

## ٩) المزامنة التلقائية (cron)

على Linux بنستخدم cron بدل الـlaunchd بتاع الماك:
```bash
crontab -e
# ضيف السطر ده (كل ٦ ساعات):
0 */6 * * * cd /var/www/drm && APP_ENV=local /usr/bin/bash scripts/sync-cron.sh
```
> `sync-cron.sh` بيسجّل في `.local/sync-cron.log` وبيمنع التشغيل المتوازي تلقائيًا.

---

## ١٠) بعد النشر

- افتح `https://your-domain.com` وادخل بحسابك.
- **إدارة المنصة** (`/platform`) هتظهر لأن `PLATFORM_ADMIN_USER_IDS` فيه ID حسابك.
- لتحديث الكود لاحقًا:
  ```bash
  cd /var/www/drm && git pull && npm install && npm run build && pm2 restart drm
  ```

## فروقات مهمة عن Vercel
| | Vercel | Hostinger VPS |
|---|---|---|
| المزامنة التلقائية | ❌ يدوي | ✅ cron |
| كل الـ48 قائمة | محدود بالتخزين | ✅ |
| دور التطبيق | مالك القاعدة | ✅ `mizan_app` (أأمن) |
| التحكم | مُدار | كامل |
