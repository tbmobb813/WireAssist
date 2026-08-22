#!/usr/bin/env bash
# Fires the Content Agent's publish_due_posts task — checks for scheduled
# posts whose scheduledAt time has arrived and publishes each one to its
# real platform (Twitter, LinkedIn, Facebook, Instagram).
#
# Unlike the daily/weekly nudge scripts, this runs every 5 minutes — posts
# have real scheduled times (e.g. a specific 9am slot), not vague daily
# windows, so a coarser cadence would mean posts going out late.
#
# Never calls the LLM (publish_due_posts is a mechanical sweep over
# already-approved posts — scheduling was the approval gate, not this), so
# it works even before ANTHROPIC_API_KEY is configured.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on publish_due_posts_complete (only when at least one
# post was published or failed; empty sweeps stay quiet) regardless of who
# triggered it, so this script doesn't duplicate that notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry and for the real platform credentials this needs before it can
# actually publish anything. Only `curl` is needed (no request body, so
# `jq` is NOT required here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[auto-publish] Checking for due posts..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/publish-due-posts")
echo "[auto-publish] Queued: $response"
