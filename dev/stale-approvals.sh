#!/usr/bin/env bash
# Fires the Admin Agent's stale_approvals_nudge task — the "Approval
# Backlog Watcher." Flags approval-queue problems three ways: individual
# requests stuck pending 3+ days, the pending count piling up past a
# threshold (default 5) regardless of any single item's age, and approvals
# a human already granted that no live process ever acted on (a restart
# orphaned them — see issue #184; ApprovalQueue.getOrphanedApprovals()).
#
# Unlike dev/proactive-insights.sh (which reflects on already-resolved
# history), this looks at what's still stuck in the approval queue right
# now — the equivalent of follow_up_nudges, but for approvals instead of
# email threads. It only reads and reports; it never resolves anything
# itself, so there's nothing extra to gate beyond the normal approval flow
# those pending requests are already waiting on.
#
# Outcomes arrive the same way any other task's do — the Telegram bot's SSE
# subscription alerts on stale_approvals_complete (only when there's
# actually something stale; a clean queue stays quiet) regardless of who
# triggered it, so this script doesn't duplicate that notification logic.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Daily makes more sense here than the weekly cadence used for
# proactive-insights/trust-graduation-nudges: an approval blocking a real
# action is more time-sensitive than a decision streak, which needs time to
# accumulate. Only `curl` is needed (no request body, so `jq` is NOT
# required here).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

echo "[stale-approvals] Checking for stale approval requests..."
response=$(curl -fsS -X POST "$API_URL/api/tasks/stale-approvals")
echo "[stale-approvals] Queued: $response"
