#!/bin/bash
# Removes the daily source-sync launchd agent.  Run:  bash scripts/uninstall-schedule.sh
set -euo pipefail
LABEL="com.nbn.sources-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl unload -w "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Removed schedule: $LABEL"
