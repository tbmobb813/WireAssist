# Deployment — Hostinger VPS

Runs Command Center (web + API) and the Telegram bot as two Docker Compose
services, restarted automatically by Docker on crash or VPS reboot. State
(SQLite DB, OAuth tokens, budget/trust-stage files) lives in a named volume
so it survives image rebuilds.

This covers punch-list item #1 (get it deployed and persistent). Items #2
(the Stage-4 heartbeat cron) and #8 (backups) are follow-ups, not covered
here — see the note at the bottom.

## 1. One-time: generate the Google OAuth token locally

Do this on your laptop, **not** the VPS. The OAuth flow spins up a
`localhost` callback server and tries to open a browser (`gmail-client.ts`)
— that can't complete over a remote SSH session.

```bash
# On your laptop, from the repo root
export WIREASSIST_HOME=/tmp/wireassist-oauth
pnpm build:core && pnpm build:admin
node packages/agents/admin/dist/demo.js
# Complete the Google OAuth prompt in your browser, then Ctrl+C once it's done.
```

This leaves two files you'll copy to the VPS in step 4:

```
/tmp/wireassist-oauth/.wireassist/gmail-credentials.json
/tmp/wireassist-oauth/.wireassist/gmail-token.json
```

## 2. Provision the VPS

SSH into the Hostinger box, then:

```bash
# Docker + Compose plugin (Debian/Ubuntu; adjust if Hostinger's image differs)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in for this to take effect
```

## 3. Clone the repo

```bash
git clone https://github.com/tbmobb813/WireAssist.git
cd WireAssist
git checkout main   # or whichever branch you want live
```

## 4. Configure secrets and copy the OAuth token

```bash
cat > .env <<'EOF'
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
WIREASSIST_BUDGET_MONTHLY=30
EOF
chmod 600 .env
```

Start the stack once so the named volume exists, then copy the OAuth files
in from your laptop:

```bash
docker compose up -d
docker compose stop   # will restart once the token is in place

# From your laptop:
scp /tmp/wireassist-oauth/.wireassist/gmail-credentials.json \
    /tmp/wireassist-oauth/.wireassist/gmail-token.json \
    user@vps-host:/tmp/

# Back on the VPS — copy into the running volume via a throwaway container:
docker run --rm -v wireassist_wireassist-data:/data -v /tmp:/src busybox \
  sh -c "cp /src/gmail-credentials.json /src/gmail-token.json /data/"
```

(Volume name is `<project-dir-name>_wireassist-data` — check the real name
with `docker volume ls` if the clone directory isn't `wireassist`.)

## 5. Bring the stack up

```bash
docker compose up -d --build
docker compose ps   # command-center should show "healthy" after ~30s
curl http://127.0.0.1:3001   # web UI should respond
```

`/health` lives on the API (port 3002), which is deliberately not published
to the host (see step 6) — `docker compose ps`'s health column is the check
that exercises it. To hit it directly for debugging:
`docker compose exec command-center wget -qO- http://127.0.0.1:3002/health`.

Command Center's web UI is now on port 3001. The Telegram bot connects to
the API over the internal Docker network — no extra config needed.

## 6. (Optional) put a domain + TLS in front of it

If you want to reach this somewhere other than `http://vps-ip:3001`:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Point your domain's DNS A record at the VPS, then edit `/etc/caddy/Caddyfile`
using this repo's `Caddyfile` as the template (fill in your real domain),
and `sudo systemctl reload caddy`. Caddy issues and renews the TLS cert
automatically. Only port 3001 needs to be reachable — the API on 3002 is
deliberately not published (see `docker-compose.yml` comments).

## Updating after a code change

```bash
git pull
docker compose up -d --build
```

## What this does NOT cover yet

- **Unattended scheduled runs (punch-list #2).** Nothing here triggers a
  Stage-4 "heartbeat" workflow run on a schedule — that still needs a
  crontab entry (or systemd timer) hitting the workflow-run endpoint. Next
  piece of work, not part of this deploy.
- **Backups (punch-list #8).** The named Docker volume is durable across
  container restarts and rebuilds, but a Hostinger disk failure still takes
  it out. Back up `wireassist-data` (e.g. `docker run --rm -v
wireassist_wireassist-data:/data -v $PWD:/backup busybox tar czf
/backup/wireassist-data-$(date +%F).tar.gz -C /data .`) somewhere off-box.
