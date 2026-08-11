# Deployment — Hostinger VPS

Runs Command Center (web + API) and the Telegram bot as two Docker Compose
services, restarted automatically by Docker on crash or VPS reboot. State
(SQLite DB, OAuth tokens, budget/trust-stage files) lives in a named volume
so it survives image rebuilds.

This covers punch-list item #1 (get it deployed and persistent), plus #2
(the Stage-4 heartbeat cron, step 8), #8 (off-box backups, step 7), and #9
(Telegram alerting on API downtime, already built into the bot — see
`packages/telegram-bot`).

## 0. Fresh VPS prep

Skip this if the box is already provisioned and hardened. Do this before
step 2 if you're starting from a clean Hostinger image.

**OS.** Ubuntu 24.04 LTS or Debian 12 — matches the Dockerfile's base image
(`node:22-bookworm-slim`) and has long support.

**Sizing / swap.** `docker build` here compiles `better-sqlite3`'s native
binding and runs a Next.js build — both spike RAM. Minimum workable is 2
vCPU / 4GB. On anything with 2GB or less, add swap first or the build gets
OOM-killed silently:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Lock down SSH before anything else touches the network.**

```bash
adduser <you>
usermod -aG sudo <you>
# copy your SSH public key to /home/<you>/.ssh/authorized_keys, then:
```

In `/etc/ssh/sshd_config`: set `PermitRootLogin no` and
`PasswordAuthentication no`, then restart the SSH service — **`systemctl
restart ssh`**, not `sshd`. Ubuntu and Debian both name the unit `ssh.service`
(`sshd` is the RHEL/CentOS convention); `systemctl restart sshd` fails with
"Unit sshd.service not found" on these images. If unsure, confirm first:
`systemctl list-units --type=service | grep -i ssh`.

**Before closing your current session**, open a second terminal and confirm
you can still log in with your key — if the config or restart went wrong,
you want a still-open session to fix it from, not to be locked out.

Install `fail2ban` for brute-force protection on whatever's left exposed:

```bash
apt install -y fail2ban
```

fail2ban's default `sshd` jail watches the systemd unit `sshd.service` via
journal matching — which, per the naming difference above, doesn't exist on
Ubuntu/Debian. Installed as-is, the jail runs but never sees a single log
line, so it silently never bans anyone. Point it at the real unit name:

```bash
sudo tee /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
journalmatch = _SYSTEMD_UNIT=ssh.service + _COMM=sshd
EOF
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd   # confirm "Journal matches" shows ssh.service, not sshd.service
```

**Firewall — deny by default.**

```bash
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Port 3001 is deliberately _not_ opened here — `docker-compose.yml` binds it
to loopback only, so it's reachable exclusively through Caddy (step 6) once
that's set up. Nothing needs a 3001 firewall rule.

**Unattended security patches.** This box runs unattended with your
Anthropic key and Gmail/Calendar access sitting on it — patching should be
automatic:

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

**Docker log rotation.** The default `json-file` log driver has no size cap
— over months, a long-running `command-center`/`telegram-bot` pair can fill
the disk with logs. Before bringing the stack up, create
`/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```

then `systemctl restart docker` (after Docker is installed in step 2).

**Confirm Docker survives a reboot.** The `get.docker.com` installer enables
this by default, but verify: `systemctl is-enabled docker` should print
`enabled`. Combined with `restart: unless-stopped` in `docker-compose.yml`,
this is what makes the stack self-heal after a VPS reboot instead of needing
you to SSH in and restart things by hand.

**DNS before Caddy.** If you're using a domain, point its A record at the
VPS's IP now — Let's Encrypt needs it to already resolve when Caddy requests
a certificate in step 6.

## 1. One-time: generate the Google OAuth token locally

Do this on your laptop, **not** the VPS. The OAuth flow spins up a
`localhost` callback server and tries to open a browser (`gmail-client.ts`)
— that can't complete over a remote SSH session.

**Create the OAuth client first**, if you don't already have one, in
[Google Cloud Console](https://console.cloud.google.com/):

1. Create or pick a project, then **APIs & Services → Library** — enable
   **Gmail API**, **Google Calendar API**, and **Google Sheets API**.
2. **APIs & Services → OAuth consent screen** — choose **External**, fill in
   the minimal required fields. It starts in **Testing** mode, which caps
   access to accounts you explicitly allow — scroll to **Test users → + Add
   users** and add your own Google account. Skipping this gets you "Access
   blocked: has not completed the Google verification process" the moment
   you try to sign in.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   — application type **Web application**, and under **Authorized redirect
   URIs** add `http://localhost:8080/` (any unprivileged port works; just
   don't leave it blank). Download the client JSON.

   Do **not** pick "Desktop app" here — Google issues those with a
   redirect URI of `http://localhost` with no port, and `gmail-client.ts`
   defaults a portless redirect to port 80, which needs root to bind and
   fails with `EACCES: permission denied 127.0.0.1:80` the moment you try
   to authorize. "Web application" with an explicit port sidesteps this
   entirely.

```bash
# On your laptop, from the repo root
export WIREASSIST_HOME=/tmp/wireassist-oauth
mkdir -p /tmp/wireassist-oauth/.wireassist
mv ~/Downloads/client_secret_*.json /tmp/wireassist-oauth/.wireassist/gmail-credentials.json
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

**Getting a Telegram bot token and chat ID**, if you don't have them yet:

1. Message **[@BotFather](https://t.me/BotFather)** on Telegram, send
   `/newbot`, follow the prompts. It replies with your `TELEGRAM_BOT_TOKEN`.
2. Send your new bot any message, then visit
   `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser (swap in
   your real token) — the JSON response includes `"chat":{"id":...}`, which
   is your `TELEGRAM_CHAT_ID`.

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

# Back on the VPS — copy into the running volume via a throwaway container.
# gmail-client.ts reads these from $WIREASSIST_HOME/.wireassist/ (== /data/.wireassist
# in the container, since the Dockerfile sets WIREASSIST_HOME=/data) — they must
# land in that subdirectory, not the volume root, or the agent reports
# "Gmail credentials not found" despite the files genuinely being present.
docker run --rm -v wireassist_wireassist-data:/data -v /tmp:/src busybox \
  sh -c "mkdir -p /data/.wireassist && cp /src/gmail-credentials.json /src/gmail-token.json /data/.wireassist/"
```

(Volume name is `<project-dir-name>_wireassist-data` — check the real name
with `docker volume ls` if the clone directory isn't `wireassist`.)

## 5. Bring the stack up

```bash
docker compose up -d --build
docker compose ps   # command-center should show "healthy" after ~30s
curl http://127.0.0.1:3001   # run on the VPS itself — web UI should respond
```

`/health` lives on the API (port 3002), which isn't published at all — see
`docker-compose.yml` comments. `docker compose ps`'s health column is the
check that exercises it. To hit it directly for debugging:
`docker compose exec command-center wget -qO- http://127.0.0.1:3002/health`.

The web UI on 3001 is bound to loopback only — reachable from `curl` on the
VPS itself, but not yet from the internet. That's intentional: step 6 puts
Caddy in front of it. If you want to reach it directly over the VPS's IP
without a domain (e.g. just to sanity-check it works before bothering with
Caddy), change the `docker-compose.yml` port line to `'3001:3001'`, run
`ufw allow 3001/tcp`, then `docker compose up -d` again — revert both once
Caddy is in place. The Telegram bot connects to the API over the internal
Docker network regardless — no extra config needed there.

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

## 6b. Or instead: private access via Tailscale

If you don't have a domain and would rather not expose the dashboard to the
public internet at all, Tailscale gives you private access from your own
devices with no TLS cert to manage and no public port beyond SSH. The
Telegram bot already covers remote control from anywhere — this just adds
the fuller dashboard UI, reachable only over your own tailnet.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# open the printed login URL in a browser, sign in to authorize the VPS
```

Install Tailscale on whatever device you'll browse from too
(<https://tailscale.com/download>), signed into the same account. Then, on
the VPS:

```bash
tailscale ip -4   # note this — it's the private address you'll browse to
```

Open the dashboard port to the Tailscale interface only — not the public
internet. `docker-compose.yml` binds port 3001 to `127.0.0.1`, which
Tailscale traffic can't reach either; widen it to all interfaces, then use
`ufw` to restrict exposure to the Tailscale interface specifically:

```bash
sed -i "s/127.0.0.1:3001:3001/0.0.0.0:3001:3001/" docker-compose.yml
sudo ufw allow in on tailscale0 to any port 3001 proto tcp
docker compose up -d
```

The public internet still hits `ufw`'s default deny (nothing opened port
3001 for it); only traffic arriving over the encrypted `tailscale0`
interface gets through. Browse to `http://<tailscale-ip>:3001` from any
device on your tailnet.

**Note:** corporate/restrictive Wi-Fi sometimes blocks Tailscale's
control-plane connection outright. If `tailscale up`'s login page or the
admin console won't load, try a mobile hotspot as a quick test.

## 7. Off-box backups

The named Docker volume survives container restarts and rebuilds, but not
a Hostinger disk failure. `dev/backup.sh` dumps the volume, encrypts it
(it contains your Gmail OAuth tokens), uploads it off-box via `rclone`,
and prunes old remote backups. Runs on the VPS via cron; failures push a
Telegram alert if `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` are in the
environment (success is silent by design).

**One-time setup:**

```bash
# Install rclone (works with any of its 70+ supported providers — S3,
# Backblaze B2, Google Drive, etc. Pick whichever you already have an
# account with; B2's free tier is generous for this use case, and needs no
# extra setup beyond an access key — if you're using B2 or S3, `rclone
# config` alone is enough, skip straight to the "Add to .env" step below)
curl https://rclone.org/install.sh | sudo bash
rclone config
```

**If your remote is Google Drive**, `rclone config` needs a bit more —
Google is retiring rclone's shared OAuth client, so it now requires you to
bring your own:

1. In `rclone config`: `n` → new remote → pick `drive` → for **scope**,
   choose **`drive.file`** (access limited to files rclone itself creates,
   not your whole Drive).
2. When it asks for `client_id`, it'll first ask "Continue using the shared
   client_id anyway?" — answer `n`, since that path is being retired. It
   then requires a real `client_id`/`client_secret`: create one in
   [Google Cloud Console](https://console.cloud.google.com/) → **APIs &
   Services → Library** → enable **Google Drive API** → **Credentials →
   Create Credentials → OAuth client ID** → type **Desktop app** (fine for
   rclone specifically — it uses a dynamic loopback port correctly, unlike
   the WireAssist OAuth flow's port-80 issue above). Paste the Client ID
   and secret in when prompted.
3. At **"Use auto config?"**, answer **`n`** — the VPS is headless, so
   answering `y` here just hangs or fails trying to open a browser that
   doesn't exist. Answering `n` prints an `rclone authorize "drive" "..."`
   command instead — run that exact command on your laptop (install rclone
   there too if needed), sign in when the browser opens, then paste the
   resulting token blob back into the still-waiting VPS prompt.

Verify with `rclone lsd <remote-name>:` — should list your Drive's
top-level folders (empty output with no error is fine; `lsd` only lists
directories, not files).

Add to `.env` (or export in the cron environment directly — cron doesn't
source `.env` automatically):

```bash
WIREASSIST_BACKUP_PASSPHRASE=<a long random passphrase, not your login password>
WIREASSIST_BACKUP_RCLONE_REMOTE=<remote-name>:<bucket-or-path>/wireassist-backups
```

**Cron entry** (nightly at 3am server time):

```bash
crontab -e
# add:
0 3 * * * cd /path/to/WireAssist && set -a && . ./.env && set +a && ./dev/backup.sh >> /var/log/wireassist-backup.log 2>&1
```

**Test it once manually** before trusting the cron job — run the same
command by hand and confirm a file lands in your rclone remote. If you
ever need to restore: `rclone copy <remote-path>/<file>.tar.gz.gpg .`,
then `gpg --decrypt <file>.tar.gz.gpg > <file>.tar.gz`, then extract into
a fresh volume the same way `docker run ... busybox tar` was used to
populate it in step 4.

## 8. Unattended scheduled runs (heartbeat)

`dev/heartbeat.sh` checks every NixOps workflow's trust stage and, for any
workflow you've explicitly promoted to **Stage 4** ("heartbeat — unattended
scheduled runs") _and_ given a `**Heartbeat brief:**` line in its own
workflow file, triggers a run automatically. Workflows below Stage 4, or at
Stage 4 without a Heartbeat brief defined, are skipped — this script never
advances a workflow's trust stage itself. Advancing a workflow to Stage 4 is
your call, per-workflow, via the Ops tab in Command Center (or `POST
/api/ops/trust/:workflow`), same as the rest of the trust ladder (punch-list
#7).

**One-time setup** — add a `**Heartbeat brief:**` line to any workflow file
you intend to run unattended, e.g. in
`packages/agents/ops/context/workflows/<name>.md`:

```
**Trust stage:** 4 (heartbeat — unattended scheduled runs)
**Heartbeat brief:** <the fixed brief this workflow should run with every time>
```

**Cron entry** (hourly, adjust to whatever cadence fits your workflows):

```bash
crontab -e
# add:
0 * * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3002 ./dev/heartbeat.sh >> /var/log/wireassist-heartbeat.log 2>&1
```

Requires `jq` (`sudo apt install -y jq`). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3002 ./dev/heartbeat.sh`) to confirm
it skips as expected before trusting it to cron — with no workflow yet at
Stage 4, it should just print a skip line per workflow and exit cleanly.

Outcomes (approved, blocked, or failed) arrive the same way any other run's
outcome does — the Telegram bot already alerts on those regardless of who
triggered the run — so this script doesn't duplicate that notification.

**Note:** `POST /api/tasks/ops-workflow` — the endpoint both this script and
the dashboard's manual "Run" button use — is gated behind the app's
`workforce`-tier license check (`tierGate('workforce')` in `server.ts`).
Check `curl http://127.0.0.1:3001/api/license/status` on the VPS; if it
returns anything other than `workforce`, ops workflow runs won't execute at
all yet, cron or manual, until a license is activated.

For your own self-hosted, single-owner deployment, there's no need to go
through `/api/license/activate` (which calls out to LemonSqueezy) just to
use your own instance — insert a `workforce`-tier row directly into the
same local SQLite DB instead, entirely offline and fully reversible:

```bash
docker compose exec command-center node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/.wireassist/wireassist.db');
db.exec(\`CREATE TABLE IF NOT EXISTS licenses (
  key TEXT PRIMARY KEY, tier TEXT NOT NULL DEFAULT 'trial', status TEXT NOT NULL DEFAULT 'inactive',
  customer_email TEXT, activations_remaining INTEGER, verified_at TEXT NOT NULL, expires_grace_at TEXT NOT NULL
)\`);
const now = new Date().toISOString();
const farFuture = new Date(Date.now() + 100*365*24*60*60*1000).toISOString();
db.prepare(\`INSERT INTO licenses (key, tier, status, customer_email, activations_remaining, verified_at, expires_grace_at)
  VALUES (?, 'workforce', 'active', NULL, NULL, ?, ?)
  ON CONFLICT(key) DO UPDATE SET tier='workforce', status='active', verified_at=excluded.verified_at, expires_grace_at=excluded.expires_grace_at\`)
  .run('self-hosted', now, farFuture);
console.log('Granted workforce tier, expires', farFuture);
"
```

## Updating after a code change

```bash
git pull
docker compose up -d --build
```
