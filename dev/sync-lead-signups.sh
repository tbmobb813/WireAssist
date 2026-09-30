#!/usr/bin/env bash
# Fires the Admin Agent's sync_lead_signups task — pulls the last 24h of
# signups from the lead-capture-service's Supabase `leads` table and
# records today's count into the scoreboard.
#
# Requires SUPABASE_URL and SUPABASE_ANON_KEY (read-only, RLS-scoped — see
# docs/DEPLOYMENT.md's scoreboard section and leads-client.ts's own
# comment) configured in .env. Without them, the task queues successfully
# but records nothing and says why — check the task's outcome (Telegram or
# Admin's memory) rather than assuming a silent success.
#
# Never calls the LLM (mechanical fetch-and-record, same reasoning as
# check_post_metrics), so it works even before ANTHROPIC_API_KEY is
# configured.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Only `curl` is needed (no request body, so `jq` is NOT required
# here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

# Self-reports to the Automations screen (Command Center) — best-effort,
# never blocks the real task below even if this fails (old server, network
# blip, etc). See automation-log.ts for what reads this.
curl -fsS -X POST "$API_URL/api/automations/ping/sync-lead-signups" >/dev/null 2>&1 || true

echo "[sync-lead-signups] Pulling last 24h of signups..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/sync-lead-signups")
echo "[sync-lead-signups] Queued: $response"
