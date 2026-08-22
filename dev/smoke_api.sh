#!/usr/bin/env bash
# Start the Command Center Hono API and run a /health smoke check.
# Pattern ported from WireAssist IPC smoke tests; targets Hono instead of Tauri.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TEMP_DIR=$(mktemp -d /tmp/wireassist-smoke-XXXXXX)
API_LOG="$TEMP_DIR/api.log"
API_PORT="${API_PORT:-3002}"
export API_PORT
export WIREASSIST_HOME="$TEMP_DIR/home"
mkdir -p "$WIREASSIST_HOME"

cleanup() {
  if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" 2>/dev/null; then
    echo "[smoke] Stopping API (PID $API_PID)..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[smoke] Using temp directory: $TEMP_DIR"
echo "[smoke] Starting Command Center API on port $API_PORT..."

cd "$ROOT_DIR"
pnpm --filter @wireassist/command-center start:api >"$API_LOG" 2>&1 &
API_PID=$!

if ! API_URL="http://127.0.0.1:${API_PORT}" bash "$SCRIPT_DIR/smoke.sh"; then
  echo "[smoke] ❌ Health check failed. API log:" >&2
  cat "$API_LOG" >&2 || true
  exit 1
fi

echo "[smoke] ✅ API smoke test passed"
