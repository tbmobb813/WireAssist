#!/usr/bin/env bash
# Fires the Admin Agent's proactive_insights task — reflects on the shared
# approval/rejection history across every agent and surfaces any repeated
# pattern (e.g. "you've rejected the last 3 proposed Friday moves in a
# row") without waiting to be asked.
#
# Like dev/daily-briefing.sh, there's no per-item trust-stage gate here: the
# skill only reads history and phrases a digest — it never proposes or
# takes an action itself, so there's nothing extra to gate beyond the
# normal approval flow those original decisions already went through.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on proactive_insights_complete (only when there's
# actually something to report; a quiet run stays quiet) regardless of who
# triggered it, so this script doesn't duplicate that notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. A weekly cadence makes more sense than daily: decision streaks
# need time to accumulate, and re-running before any new decisions have
# landed just re-reports the same pattern. Requires `jq` is NOT needed here
# (no request body), only `curl`.

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[proactive-insights] Triggering proactive insights check..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/proactive-insights")
echo "[proactive-insights] Queued: $response"
