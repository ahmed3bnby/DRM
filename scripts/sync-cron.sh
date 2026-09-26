#!/bin/bash
# Incremental source sync for cron / launchd.
# Compatible with macOS and Linux VPS (Hostinger, Ubuntu, Debian, CentOS).
# Logs to .local/sync-cron.log. Requires Postgres to be reachable.
set -o pipefail
cd "$(dirname "$0")/.." || exit 1
export APP_ENV=local

# Dynamically locate node executable across macOS and Linux VPS environments
NODE_CMD=""
if command -v node >/dev/null 2>&1; then
  NODE_CMD="$(command -v node)"
else
  for p in /usr/bin/node /usr/local/bin/node /opt/homebrew/bin/node "$HOME/.nvm/versions/node"/*/bin/node; do
    if [ -x "$p" ]; then
      NODE_CMD="$p"
      break
    fi
  done
fi

if [ -z "$NODE_CMD" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') error: node runtime not found" >> .local/sync-cron.log
  exit 1
fi

mkdir -p .local
# Single-instance atomic directory lock
LOCK=.local/sync.lock
if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
  rmdir "$LOCK" 2>/dev/null
fi

if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') sync skipped — a run is already in progress" >> .local/sync-cron.log
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "===== $(date '+%Y-%m-%d %H:%M:%S') sync start =====" >> .local/sync-cron.log
"$NODE_CMD" scripts/sync-runner.mjs --scheduled >> .local/sync-cron.log 2>&1
status=$?
echo "===== sync end (exit $status) =====" >> .local/sync-cron.log
exit $status
