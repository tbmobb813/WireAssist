#!/usr/bin/env bash
# Punch-list #2: fires any NixOps workflow that's earned unattended trust.
#
# For each workflow, this script only triggers a run if BOTH are true:
#   1. Its trust stage is 4 ("heartbeat — unattended scheduled runs") — set
#      via the Ops tab in Command Center or `POST /api/ops/trust/:workflow`.
#      Stages 2 and 3 are silently skipped; advancing a workflow to 4 is a
#      deliberate, per-workflow decision only JNix makes (see SOUL.md's trust
#      ladder) — this script never does that for you.
#   2. Its workflow file (packages/agents/ops/context/workflows/<name>.md)
#      defines a `**Heartbeat brief:**` line — the fixed brief to pass on
#      every unattended run, since a human isn't there to type one each time.
#      A workflow at stage 4 with no such line is skipped with a warning:
#      trust alone isn't enough, there also has to be something to run.
#
# Outcomes (approved/blocked/failed) arrive the same way any other run's
# outcome does — the Telegram bot's SSE subscription already alerts on
# ops_run_complete/ops_blocked/task_failed regardless of who triggered the
# run, so this script doesn't duplicate that notification logic. Likewise,
# if the API itself is down, the bot's independent health-check loop
# (packages/telegram-bot) already alerts on that — this script just tries
# once per invocation and lets cron's own log capture failures.
#
# Meant to run from cron on the VPS — see docs/DEPLOYMENT.md for the cron
# entry. Requires `jq` (`apt install -y jq`).

set -euo pipefail

API_URL="${WIREASSIST_API_URL:-http://localhost:3002}"

if ! command -v jq >/dev/null 2>&1; then
  echo "[heartbeat] ERROR: jq is not installed (apt install -y jq)" >&2
  exit 1
fi

workflows=$(curl -fsS "$API_URL/api/ops/workflows" | jq -r '.workflows[]')
if [[ -z "$workflows" ]]; then
  echo "[heartbeat] No workflows found."
  exit 0
fi

while IFS= read -r workflow; do
  stage=$(curl -fsS "$API_URL/api/ops/trust/$workflow" | jq -r '.stage')

  if [[ "$stage" != "4" ]]; then
    echo "[heartbeat] Skipping '$workflow': trust stage $stage (needs 4)."
    continue
  fi

  content=$(curl -fsS "$API_URL/api/ops/workflows/$workflow" | jq -r '.content')
  brief=$(echo "$content" | { grep -m1 '^\*\*Heartbeat brief:\*\*' || true; } | sed 's/^\*\*Heartbeat brief:\*\*[[:space:]]*//')

  if [[ -z "$brief" ]]; then
    echo "[heartbeat] Skipping '$workflow': at stage 4 but no '**Heartbeat brief:**' line in its workflow file."
    continue
  fi

  echo "[heartbeat] Triggering '$workflow' with brief: $brief"
  response=$(curl -fsS -X POST "$API_URL/api/tasks/ops-workflow" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg workflow "$workflow" --arg brief "$brief" '{workflow: $workflow, brief: $brief}')")
  echo "[heartbeat] Queued: $response"
done <<< "$workflows"
