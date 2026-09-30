#!/usr/bin/env bash
# Fires the Admin Agent's scoreboard_digest task — a weekly synthesis over
# every scoreboard source (content engagement, lead signups so far):
# what moved, any real win, one suggested action. Reads the same `metrics`
# table sync-scoreboard-metrics.sh and sync-lead-signups.sh write to.
#
# Weekly, Monday morning — set up those two daily sync crons first, or
# this digest has nothing to synthesize (it says so directly rather than
# inventing numbers — see scoreboard-digest.ts).
#
# Requires ANTHROPIC_API_KEY configured, and costs a real LLM call
# (one think() synthesis) — unlike the free sync crons above.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Only `curl` is needed (no request body, so `jq` is NOT required
# here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

# Self-reports to the Automations screen (Command Center) — best-effort,
# never blocks the real task below even if this fails (old server, network
# blip, etc). See automation-log.ts for what reads this.
curl -fsS -X POST "$API_URL/api/automations/ping/scoreboard-digest" >/dev/null 2>&1 || true

echo "[scoreboard-digest] Synthesizing this week's scoreboard..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/scoreboard-digest")
echo "[scoreboard-digest] Queued: $response"
