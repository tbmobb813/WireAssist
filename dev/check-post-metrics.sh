#!/usr/bin/env bash
# Fires the Content Agent's check_post_metrics task — for every published
# post that's hit its 24h or 7d mark since publishing and hasn't been
# checked for that window yet, fetches real engagement (likes/views/
# comments/shares) from the post's real platform and stores it.
#
# Hourly, not every-5-minutes like auto-publish.sh — a metrics check has
# no fixed-minute deadline the way a scheduled post does, so this cadence
# is about catching the 24h/7d marks promptly, not urgency.
#
# Never calls the LLM (check_post_metrics is a mechanical fetch-and-store
# sweep, same reasoning as publish_due_posts), so it works even before
# ANTHROPIC_API_KEY is configured.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Only `curl` is needed (no request body, so `jq` is NOT required
# here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

# Self-reports to the Automations screen (Command Center) — best-effort,
# never blocks the real task below even if this fails (old server, network
# blip, etc). See automation-log.ts for what reads this.
curl -fsS -X POST "$API_URL/api/automations/ping/check-post-metrics" >/dev/null 2>&1 || true

echo "[check-post-metrics] Checking for posts due a metrics check..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/check-post-metrics")
echo "[check-post-metrics] Queued: $response"
