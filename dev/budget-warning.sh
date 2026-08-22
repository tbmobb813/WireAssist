#!/usr/bin/env bash
# Fires the Admin Agent's budget_warning_nudge task — checks month-to-date
# agent spend against a warning threshold (default 80% of the monthly cap)
# and reports whether it's been crossed.
#
# Unlike the other proactive-nudge scripts, this one never calls the LLM
# itself (budgetTracker.assertWithinBudget() already guards every real
# think() call, so spending against the budget in order to warn about the
# budget would be a little absurd) — it's plain arithmetic on already-
# recorded usage, so it works even before ANTHROPIC_API_KEY is configured.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on budget_warning_complete (only when the threshold
# is actually crossed; under-threshold runs stay quiet) regardless of who
# triggered it, so this script doesn't duplicate that notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Daily makes sense here (same reasoning as stale-approvals): once
# you're over the threshold, spend only climbs further before the monthly
# reset, so a same-day heads-up matters more than a weekly one. Only
# `curl` is needed (no request body, so `jq` is NOT required here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[budget-warning] Checking month-to-date spend against the warning threshold..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/budget-warning")
echo "[budget-warning] Queued: $response"
