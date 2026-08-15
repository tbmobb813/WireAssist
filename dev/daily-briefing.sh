#!/usr/bin/env bash
# Fires the Admin Agent's daily_briefing task (inbox triage + calendar
# review, combined into one digest) on a schedule instead of waiting for a
# manual click.
#
# Unlike dev/heartbeat.sh, there's no per-item trust-stage gate here: the
# underlying email_triage/calendar_review skills already route every
# proposed action through the normal approval queue (or the narrow
# ignore-labeling auto-approval carve-out), regardless of who triggered the
# task. Running this unattended carries no extra risk beyond a manual run —
# installing this script's cron entry IS the opt-in decision.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription already alerts on daily_briefing_complete/task_failed
# regardless of who triggered the run, so this script doesn't duplicate
# that notification logic. If the API itself is down, the bot's independent
# health-check loop already alerts on that — this script just tries once
# per invocation and lets cron's own log capture failures.
#
# Meant to run from cron on the VPS once a day (a morning hour makes the
# most sense) — see docs/DEPLOYMENT.md for the cron entry. Requires `jq`
# (`apt install -y jq`), same as dev/heartbeat.sh.

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

if ! command -v jq >/dev/null 2>&1; then
  echo "[daily-briefing] ERROR: jq is not installed (apt install -y jq)" >&2
  exit 1
fi

# DAILY_BRIEFING_MAX_EMAILS/DAILY_BRIEFING_DAYS_AHEAD are optional — omitted
# fields fall back to the API's own defaults (20 emails, 7 days ahead).
body=$(jq -n \
  --arg maxEmails "${DAILY_BRIEFING_MAX_EMAILS:-}" \
  --arg daysAhead "${DAILY_BRIEFING_DAYS_AHEAD:-}" \
  '{}
   + (if $maxEmails != "" then {maxEmails: ($maxEmails | tonumber)} else {} end)
   + (if $daysAhead != "" then {daysAhead: ($daysAhead | tonumber)} else {} end)')

echo "[daily-briefing] Triggering daily briefing..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/daily-briefing" \
  -H "Content-Type: application/json" \
  -d "$body")
echo "[daily-briefing] Queued: $response"
