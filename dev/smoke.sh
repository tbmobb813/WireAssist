#!/usr/bin/env bash
# Wait for the Command Center Hono API /health endpoint.
# Assumes the API is already running (see smoke_api.sh to start it).

set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:3002}"
HEALTH_URL="${API_URL%/}/health"
TIMEOUT="${SMOKE_TIMEOUT:-30}"
SLEEP=1
elapsed=0

echo "Waiting for API health at ${HEALTH_URL} (timeout ${TIMEOUT}s) ..."
while [ "$elapsed" -lt "$TIMEOUT" ]; do
  if body=$(curl -sSf "$HEALTH_URL" 2>/dev/null); then
    if echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
      echo "API /health returned status ok — smoke test PASSED"
      echo "$body"
      exit 0
    fi
  fi
  sleep "$SLEEP"
  elapsed=$((elapsed + SLEEP))
done

echo "Timed out waiting for API health at ${HEALTH_URL} — smoke test FAILED" >&2
exit 2
