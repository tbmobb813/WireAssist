#!/usr/bin/env bash
# Fires the Admin Agent's expense_digest task — scans Gmail for receipts
# and invoices in the last 30 days (default) and summarizes spend by
# category via think(). Distinct from budget_warning_nudge, which tracks
# WireAssist's own AI-spend cap, not real personal/business expenses.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on expense_digest_complete (only when receipts were
# actually found; a quiet stretch stays silent) regardless of who triggered
# it, so this script doesn't duplicate that notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Monthly — matches content-retro's reasoning that a spend summary
# needs a longer window than any daily/weekly nudge. Requires
# ANTHROPIC_API_KEY and Gmail credentials already configured. No `jq`
# needed (no request body).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[expense-digest] Summarizing recent receipts and invoices..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/expense-digest")
echo "[expense-digest] Queued: $response"
