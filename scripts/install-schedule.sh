#!/bin/bash
# Installs a per-user launchd agent that runs the incremental source sync daily at 03:30.
# Run once:  bash scripts/install-schedule.sh   (no sudo needed — it's a user LaunchAgent).
# Change the time by editing HOUR/MINUTE below, then re-run.
set -euo pipefail
HOUR=3
MINUTE=30
LABEL="com.nbn.sources-sync"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST="$AGENTS_DIR/$LABEL.plist"
mkdir -p "$AGENTS_DIR" "$PROJECT_DIR/.local"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROJECT_DIR/scripts/sync-cron.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>$MINUTE</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$PROJECT_DIR/.local/launchd.log</string>
  <key>StandardErrorPath</key><string>$PROJECT_DIR/.local/launchd.log</string>
</dict>
</plist>
PLISTEOF

# Reload (ignore "not loaded" on first install).
launchctl unload -w "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"
printf 'Scheduled: %s runs daily at %02d:%02d\n' "$LABEL" "$HOUR" "$MINUTE"
printf 'Plist: %s\nLogs:  %s/.local/sync-cron.log\n' "$PLIST" "$PROJECT_DIR"
printf 'Verify: launchctl list | grep %s\nRemove: bash scripts/uninstall-schedule.sh\n' "$LABEL"
