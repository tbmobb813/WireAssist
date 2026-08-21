#!/usr/bin/env bash
# Fires the Admin Agent's detect_skill_opportunities task — looks across
# recent freeform requests (tagged by every agent's freeform.ts) for a
# genuine repeated pattern that a purpose-built skill could handle better
# than a one-off chat reply.
#
# Proposal-only, never autonomous: if a pattern is found, it's proposed for
# approval (gate 1) before anything happens. Only on approval does it hand
# off a request to the relevant agent's own propose_skill, which drafts
# real code and gates that separately (gate 2) — this never opens a PR
# without two separate human approvals along the way.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on detect_skill_opportunities_complete (only when a
# pattern was actually found; a quiet stretch stays silent) regardless of
# who triggered it, so this script doesn't duplicate that notification
# logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Weekly, offset from the existing Monday weekly nudges to spread
# cron load — patterns need time to accumulate, same reasoning as
# proactive-insights.sh/trust-graduation-nudges.sh. Requires
# ANTHROPIC_API_KEY configured. No `jq` needed (no request body).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[detect-skill-opportunities] Looking for a repeated request pattern..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/detect-skill-opportunities")
echo "[detect-skill-opportunities] Queued: $response"
