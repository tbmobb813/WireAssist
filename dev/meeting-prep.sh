#!/usr/bin/env bash
# Fires the Admin Agent's meeting_prep task — scans the calendar for
# meetings starting within the next 2 hours (default), and for each one
# with attendees, drafts prep notes (recent email threads with them,
# suggested talking points) via think().
#
# Idempotent by design: each prepped event gets a marker remembered
# against it (meeting-prep-done:<eventId>), checked before prepping again
# — so running this every 30 minutes never re-prepares the same meeting
# twice as it drifts through the lookahead window on successive ticks.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on meeting_prep_complete (only when there's something
# to prep; a quiet stretch with no upcoming meetings stays silent)
# regardless of who triggered it, so this script doesn't duplicate that
# notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Every 30 minutes — the one nudge in this doc needing sub-daily
# cadence, since a meeting needs prep before it happens, not once a day at
# an arbitrary time. Requires ANTHROPIC_API_KEY and Gmail/Calendar
# credentials already configured. No `jq` needed (no request body).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[meeting-prep] Checking for upcoming meetings that need prep..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/meeting-prep")
echo "[meeting-prep] Queued: $response"
