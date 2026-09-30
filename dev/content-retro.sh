#!/usr/bin/env bash
# Fires the Content Agent's content_retro task — analyzes every post
# published in the last 30 days (default) via content_analyze, then
# synthesizes a short performance retro via think(): what's working, what's
# falling flat, one concrete thing to try next.
#
# Unlike the deterministic nudges (stale-approvals, stale-prs,
# objective-health-check), this always has something to say — even a quiet
# period with zero posts published gets a real note about it — so it always
# pings Telegram, never silently skips.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Monthly makes sense here: performance trends need a longer window
# than any existing nudge, and this costs real LLM calls (one content_analyze
# per post, plus one think() synthesis), unlike the free deterministic
# nudges above. Requires ANTHROPIC_API_KEY configured. No `jq` needed (no
# request body).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

# Self-reports to the Automations screen (Command Center) — best-effort,
# never blocks the real task below even if this fails (old server, network
# blip, etc). See automation-log.ts for what reads this.
curl -fsS -X POST "$API_URL/api/automations/ping/content-retro" >/dev/null 2>&1 || true

echo "[content-retro] Running content performance retro..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/content-retro")
echo "[content-retro] Queued: $response"
