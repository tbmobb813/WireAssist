#!/usr/bin/env bash
# Fires the GitHub Dev Agent's stale_prs_nudge task — scans every open pull
# request on the configured repo (WIREASSIST_REPO, default tbmobb813/WireAssist)
# and flags any that have gone 5+ days (default) without an update.
#
# Same shape as dev/stale-approvals.sh, but for pull requests instead of the
# approval queue. It only reads and reports; it never comments, labels, or
# closes anything itself.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on stale_prs_complete (only when something is actually
# stale; a clean PR list stays quiet) regardless of who triggered it, so this
# script doesn't duplicate that notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Daily makes more sense here than the weekly cadence used for
# proactive-insights/trust-graduation-nudges: a stuck PR is more
# time-sensitive than a decision streak, which needs time to accumulate.
# Only `curl` is needed (no request body, so `jq` is NOT required here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[stale-prs] Checking for stale open pull requests..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/stale-prs")
echo "[stale-prs] Queued: $response"
