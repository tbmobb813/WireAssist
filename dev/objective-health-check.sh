#!/usr/bin/env bash
# Fires the Admin Agent's objective_health_check_nudge task — scans every
# active Objective and flags any that have gone 5+ days (default) without
# any agent activity recorded against it.
#
# Unlike stale_approvals_nudge (which watches the approval queue), this
# watches a slower-moving signal: whether work toward a stated Objective has
# actually kept happening, not just whether a single request is stuck. It
# only reads and reports — it never touches an Objective's status itself.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on objective_health_check_complete (only when
# something is actually stale; a healthy set of Objectives stays quiet)
# regardless of who triggered it, so this script doesn't duplicate that
# notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Weekly makes more sense here than stale-approvals' daily cadence:
# Objectives drift slower than an individual approval sitting unread. Only
# `curl` is needed (no request body, so `jq` is NOT required here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[objective-health-check] Checking for quiet Objectives..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/objective-health-check")
echo "[objective-health-check] Queued: $response"
