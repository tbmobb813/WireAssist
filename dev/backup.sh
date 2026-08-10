#!/usr/bin/env bash
# Off-box backup of the WireAssist Docker volume (SQLite DB, OAuth tokens,
# budget/trust-stage files). Dumps the volume, encrypts it, uploads it via
# rclone to whatever remote you've configured, then prunes old remote
# backups past the retention window. Meant to run from cron on the VPS —
# see docs/DEPLOYMENT.md for the cron entry and one-time rclone setup.
#
# Required env:
#   WIREASSIST_BACKUP_PASSPHRASE   symmetric encryption passphrase (gpg).
#                                   The volume contains Gmail OAuth tokens —
#                                   never upload it unencrypted.
#   WIREASSIST_BACKUP_RCLONE_REMOTE   rclone destination, e.g.
#                                   "b2:my-bucket/wireassist-backups"
#                                   (any rclone-supported provider works —
#                                   see `rclone config`)
#
# Optional env:
#   WIREASSIST_BACKUP_VOLUME   Docker volume name. Auto-detected (first
#                               volume matching *wireassist-data*) if unset.
#   WIREASSIST_BACKUP_RETAIN_DAYS   remote backups older than this are
#                               deleted after a successful upload (default 14).
#   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID   if set, failures are pushed to
#                               Telegram in addition to stderr. Success is
#                               silent by design — only failures interrupt.

set -euo pipefail

RETAIN_DAYS="${WIREASSIST_BACKUP_RETAIN_DAYS:-14}"

notify_failure() {
  local msg="$1"
  echo "[backup] ERROR: $msg" >&2
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=🔴 WireAssist backup failed: ${msg}" >/dev/null 2>&1 || true
  fi
}

on_error() {
  notify_failure "line ${1}: command failed"
  exit 1
}
trap 'on_error $LINENO' ERR

if [[ -z "${WIREASSIST_BACKUP_PASSPHRASE:-}" ]]; then
  notify_failure "WIREASSIST_BACKUP_PASSPHRASE is not set"
  exit 1
fi
if [[ -z "${WIREASSIST_BACKUP_RCLONE_REMOTE:-}" ]]; then
  notify_failure "WIREASSIST_BACKUP_RCLONE_REMOTE is not set"
  exit 1
fi
if ! command -v rclone >/dev/null 2>&1; then
  notify_failure "rclone is not installed (see docs/DEPLOYMENT.md)"
  exit 1
fi

VOLUME="${WIREASSIST_BACKUP_VOLUME:-}"
if [[ -z "$VOLUME" ]]; then
  VOLUME=$(docker volume ls --filter name=wireassist-data --format '{{.Name}}' | head -n1)
fi
if [[ -z "$VOLUME" ]]; then
  notify_failure "no Docker volume matching *wireassist-data* found; set WIREASSIST_BACKUP_VOLUME"
  exit 1
fi

TEMP_DIR=$(mktemp -d /tmp/wireassist-backup-XXXXXX)
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
TARBALL="$TEMP_DIR/wireassist-data-${STAMP}.tar.gz"
ENCRYPTED="$TARBALL.gpg"

echo "[backup] Dumping volume '$VOLUME'..."
docker run --rm -v "${VOLUME}:/data:ro" -v "$TEMP_DIR:/backup" busybox \
  tar czf "/backup/$(basename "$TARBALL")" -C /data .

echo "[backup] Encrypting..."
gpg --batch --yes --passphrase "$WIREASSIST_BACKUP_PASSPHRASE" \
  --symmetric --cipher-algo AES256 -o "$ENCRYPTED" "$TARBALL"
rm -f "$TARBALL"

echo "[backup] Uploading to $WIREASSIST_BACKUP_RCLONE_REMOTE..."
rclone copy "$ENCRYPTED" "$WIREASSIST_BACKUP_RCLONE_REMOTE" --checksum

echo "[backup] Pruning remote backups older than ${RETAIN_DAYS}d..."
rclone delete "$WIREASSIST_BACKUP_RCLONE_REMOTE" --min-age "${RETAIN_DAYS}d"

echo "[backup] Done: $(basename "$ENCRYPTED")"
