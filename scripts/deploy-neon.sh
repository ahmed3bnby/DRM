#!/usr/bin/env bash
# Prepare a Neon database for the Vercel demo: schema + restricted app role + demo org/users
# + a SUBSET of the watchlists copied from the local database.
#
# 1. Create .env.neon (git-ignored) with:
#      NEON_OWNER_URL=postgres://neondb_owner:…@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require   # the "unpooled" owner URL
#      APP_DB_PASSWORD=<new strong password for the restricted mizan_app role, 16+ chars, letters+digits>
#      DEMO_PASSWORD=<password for demo@mizan.test, 12+ chars>
# 2. bash scripts/deploy-neon.sh
# 3. Put the printed APP_DATABASE_URL (mizan_app — NOT the owner) into Vercel's environment variables.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.neon ] || { echo "Missing .env.neon (see header of this script)"; exit 1; }
set -a; source .env.neon; set +a
: "${NEON_OWNER_URL:?set NEON_OWNER_URL in .env.neon}" "${APP_DB_PASSWORD:?set APP_DB_PASSWORD}" "${DEMO_PASSWORD:?set DEMO_PASSWORD}"

# The app connects as mizan_app (NOBYPASSRLS) so row-level security isolates organizations.
# Neon's owner role has BYPASSRLS — never give the owner URL to the running app.
APP_URL=$(node -e '
  const u = new URL(process.env.NEON_OWNER_URL);
  u.username = "mizan_app"; u.password = encodeURIComponent(process.env.APP_DB_PASSWORD);
  console.log(u.toString());')

echo "→ 1/3 schema, roles, demo organization"
APP_ENV=local ALLOW_REMOTE_DB_SETUP=1 SEED_DEMO_CUSTOMERS="${SEED_DEMO_CUSTOMERS:-1}" \
  DATABASE_URL="$APP_URL" DATABASE_ADMIN_URL="$NEON_OWNER_URL" DEMO_PASSWORD="$DEMO_PASSWORD" \
  node --import tsx scripts/setup-db.ts
APP_ENV=local DATABASE_URL="$APP_URL" DATABASE_ADMIN_URL="$NEON_OWNER_URL" \
  node --import tsx scripts/migrate-customer-search.ts

echo "→ 2/3 copying the watchlist subset from the local database"
TARGET_ADMIN_URL="$NEON_OWNER_URL" node --env-file=.env.local --import tsx scripts/seed-remote-subset.ts

echo "→ 3/3 checking the app role really is restricted"
node -e '
  const {Pool} = require("pg");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.argv[1]);
  const p = new Pool({connectionString: process.argv[1], ...(local ? {} : {ssl: {rejectUnauthorized: false}})});
  p.query("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user")
    .then(r => { const x = r.rows[0]; if (x.rolbypassrls || x.rolsuper) { console.error("✗ mizan_app can bypass RLS!"); process.exit(1); } console.log("✓ mizan_app is restricted (no superuser, no BYPASSRLS)"); })
    .catch(e => { console.error("✗ cannot connect as mizan_app:", e.message); process.exit(1); })
    .finally(() => p.end());' "$APP_URL"

echo
echo "Done. In Vercel → Settings → Environment Variables (Production) set:"
echo "  APP_DATABASE_URL = postgres://mizan_app:<APP_DB_PASSWORD>@<same host>/neondb?sslmode=require"
echo "  (same as NEON_OWNER_URL but user mizan_app and your APP_DB_PASSWORD — the app switches to the -pooler host itself)"
