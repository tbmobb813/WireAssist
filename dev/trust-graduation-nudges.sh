#!/usr/bin/env bash
# Fires NixOps's trust_graduation_nudges task — looks for any workflow
# that's been approved 3 times in a row at trust stage 2 and, for each one
# found, proposes graduating it to stage 3 through the normal approval
# queue. Approving that proposal advances the stage immediately (via
# setTrustStage(), which also keeps the workflow file's own "**Trust
# stage:**" line in sync); rejecting it leaves the workflow at stage 2.
#
# Like dev/proactive-insights.sh, this only reads approval history to
# decide what to *propose* — it never flips a trust stage on its own, so
# there's nothing extra to gate beyond the normal approval flow the
# graduation nudge itself goes through.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on trust_graduation_nudges_complete (only when
# there's actually something to report; a quiet run stays quiet) regardless
# of who triggered it, so this script doesn't duplicate that notification
# logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. A weekly cadence makes more sense than daily: approval streaks
# need time to accumulate, and re-running before any new decisions have
# landed just re-checks the same state. Only `curl` is needed (no request
# body, so `jq` is NOT required here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[trust-graduation-nudges] Triggering trust-graduation nudge check..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/ops-trust-nudges")
echo "[trust-graduation-nudges] Queued: $response"
