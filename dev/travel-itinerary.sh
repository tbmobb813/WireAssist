#!/usr/bin/env bash
# Fires the Admin Agent's travel_itinerary_digest task — scans Gmail for
# travel-confirmation emails and cross-references upcoming Calendar events,
# compiling a single itinerary digest via think().
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on travel_itinerary_digest_complete (only when travel
# was actually detected; a quiet stretch with nothing upcoming stays silent)
# regardless of who triggered it, so this script doesn't duplicate that
# notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Daily — travel plans can surface any day, same reasoning as the
# stale-PR nudge. Requires ANTHROPIC_API_KEY and Gmail/Calendar credentials
# already configured. No `jq` needed (no request body).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[travel-itinerary] Checking for upcoming travel..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/travel-itinerary")
echo "[travel-itinerary] Queued: $response"
