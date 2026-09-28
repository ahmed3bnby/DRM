#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DRM — one-shot VPS deployment (Ubuntu, run as root over SSH).
# Installs Node + PostgreSQL + Python + Nginx, builds the app, seeds the
# database, imports the watchlists, starts it under PM2 behind HTTPS, and
# schedules the source sync. Safe to re-run (idempotent).
#
#   1) Edit the CONFIG block below (5 values).
#   2) chmod +x deploy.sh && ./deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ============================ CONFIG — EDIT THESE =============================
DOMAIN="your-domain.com"                    # your domain, DNS A-record pointed to this server
DB_PASS="CHANGE_ME_app_db_password"         # password for the app DB role (mizan_app)
PG_PASS="CHANGE_ME_postgres_password"       # password for the postgres admin role
DEMO_PASS="CHANGE_ME_min_12_chars"          # seed/demo account password (>= 12 chars)
ADMIN_UUID="97e80963-ec89-4e76-9807-26ae85f7d659"  # your platform-owner user id
REPO="https://github.com/ahmed3bnby/DRM.git"       # private repo? use https://<TOKEN>@github.com/ahmed3bnby/DRM.git
# Optional:
APP_DIR="/var/www/drm"
DB_NAME="drm"
NODE_MAJOR="22"
ENABLE_HTTPS="yes"                          # "no" to skip certbot (e.g. before DNS is ready)
IMPORT_ALL_LISTS="yes"                      # "no" for a faster first boot (import later)
# =============================================================================

step(){ echo; echo "▶ $*"; }
for v in DOMAIN DB_PASS PG_PASS DEMO_PASS; do
  case "${!v}" in *CHANGE_ME*|your-domain.com) echo "✗ Edit CONFIG: $v is still a placeholder"; exit 1;; esac
done
[ "${#DEMO_PASS}" -ge 12 ] || { echo "✗ DEMO_PASS must be at least 12 characters"; exit 1; }

step "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git nginx python3 ufw curl ca-certificates

step "Firewall"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

step "Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v

step "PostgreSQL"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
ALTER USER postgres PASSWORD '${PG_PASS}';
SELECT 'CREATE DATABASE ${DB_NAME}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='${DB_NAME}')\gexec
SQL

step "Clone / update repo"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

step "Environment file"
cat > "$APP_DIR/.env.production.local" <<ENV
DATABASE_URL=postgresql://mizan_app:${DB_PASS}@localhost:5432/${DB_NAME}
APP_ORIGIN=https://${DOMAIN}
PLATFORM_ADMIN_USER_IDS=${ADMIN_UUID}
NODE_ENV=production
APP_ENV=local
DATABASE_ADMIN_URL=postgresql://postgres:${PG_PASS}@localhost:5432/${DB_NAME}
DEMO_PASSWORD=${DEMO_PASS}
ENV
chmod 600 "$APP_DIR/.env.production.local"

step "Install dependencies & build"
npm ci || npm install
npm run build

step "Database schema + seed (all migrations incl. audit immutability)"
node --env-file=.env.production.local --import tsx scripts/setup-db.ts

if [ "$IMPORT_ALL_LISTS" = "yes" ]; then
  step "Fetch + import watchlists (this can take several minutes)"
  CODES="$(node -e "console.log(require('./scripts/watchlist.json').datasets.join(' '))")"
  python3 scripts/connectors/opensanctions.py catalog || true
  # shellcheck disable=SC2086
  python3 scripts/connectors/opensanctions.py $CODES || true
  # shellcheck disable=SC2086
  node --env-file=.env.production.local --import tsx scripts/import-sources.ts $CODES || true
fi

step "Process manager (PM2)"
npm install -g pm2
pm2 delete drm >/dev/null 2>&1 || true
APP_ORIGIN="https://${DOMAIN}" NODE_ENV=production pm2 start "npm run start" --name drm --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

step "Nginx reverse proxy"
cat > /etc/nginx/sites-available/drm <<NGINX
server {
  listen 80;
  server_name ${DOMAIN};
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/drm /etc/nginx/sites-enabled/drm
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

if [ "$ENABLE_HTTPS" = "yes" ]; then
  step "HTTPS (Let's Encrypt)"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect || \
    echo "⚠ certbot failed (is the DNS A-record pointed to this server?). Re-run later: certbot --nginx -d ${DOMAIN}"
fi

step "Scheduled source sync (every 6 hours)"
CRON_LINE="0 */6 * * * cd ${APP_DIR} && APP_ENV=local /usr/bin/bash scripts/sync-cron.sh"
( crontab -l 2>/dev/null | grep -v 'scripts/sync-cron.sh' ; echo "$CRON_LINE" ) | crontab -

echo
echo "✅ Done. Open: https://${DOMAIN}"
echo "   Sign in with the demo admin (demo@mizan.test) or your own account."
echo "   Update later:  cd ${APP_DIR} && git pull && npm install && npm run build && pm2 restart drm"
