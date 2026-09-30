#!/usr/bin/env bash
# Fires the Content Agent's sync_scoreboard_metrics task — rolls up every
# published post's currently-known engagement (likes/views/comments/shares,
# from check-post-metrics.sh's hourly checks) into today's scoreboard
# totals, read by the Admin Agent's weekly scoreboard_digest.
#
# Daily, after check-post-metrics.sh has had most of the day's hourly runs
# a chance to fill in real numbers — a coarser cadence than hourly is fine
# since this is a full re-sum each time, not a delta.
#
# Never calls the LLM (mechanical aggregation, same reasoning as
# publish_due_posts/check_post_metrics), so it works even before
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
curl -fsS -X POST "$API_URL/api/automations/ping/sync-scoreboard-metrics" >/dev/null 2>&1 || true

echo "[sync-scoreboard-metrics] Rolling up today's content totals..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/sync-scoreboard-metrics")
echo "[sync-scoreboard-metrics] Queued: $response"
