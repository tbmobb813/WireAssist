#!/usr/bin/env bash
# Fires the Admin Agent's meeting_followup task — the other half of
# meeting_prep. Scans for meetings that ended in the last 3 hours (default)
# and, for each one with attendees, drafts a summary and likely action
# items via think().
#
# Idempotent by design: each followed-up event gets a marker remembered
# against it (meeting-followup-done:<eventId>), checked before following up
# again — same trick meeting-prep.sh uses, so running this every 30 minutes
# never re-follows-up the same meeting twice.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on meeting_followup_complete (only when there's
# something to follow up on; a quiet stretch stays silent) regardless of
# who triggered it, so this script doesn't duplicate that notification
# logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Every 30 minutes — same sub-daily cadence as meeting-prep.sh, for
# the same reason: a follow-up is only useful shortly after the meeting
# ends, not once a day at an arbitrary time. Requires ANTHROPIC_API_KEY and
# Gmail/Calendar credentials already configured. No `jq` needed (no request
# body).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[meeting-followup] Checking for recently ended meetings that need a follow-up..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/meeting-followup")
echo "[meeting-followup] Queued: $response"
