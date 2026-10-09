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

# Optional — only needed if you're using auto-publish (section 14). Add
# credentials for whichever platforms you actually plan to publish to;
# see section 14 for how to obtain each one.
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_PERSON_URN=...
META_ACCESS_TOKEN=...
FACEBOOK_PAGE_ID=...
INSTAGRAM_ACCOUNT_ID=...
INSTAGRAM_DEFAULT_IMAGE_URL=...
EOF
chmod 600 .env
```

**Adding or changing a variable in `.env` later?** `docker compose restart`
does _not_ re-read it — that just restarts the existing container with
whatever environment it was created with. Use
`docker compose up -d command-center` instead, which recreates the
container and picks up the new value.

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

If you're also using the GitHub Dev Agent, copy its credentials file into the same
volume the same way (see `docs/SETUP.md`'s "GitHub Dev Agent" section for how to
generate the token):

```bash
# From your laptop:
scp ~/.wireassist/github-credentials.json user@vps-host:/tmp/

# Back on the VPS:
docker run --rm -v wireassist_wireassist-data:/data -v /tmp:/src busybox \
  sh -c "cp /src/github-credentials.json /data/.wireassist/"
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

## 6c. Or: public HTTPS behind Google sign-in (for networks that block Tailscale)

Use this when you need the full web UI from a work network that blocks
Tailscale. It puts the dashboard at `https://wireassist.techtrendwire.com`,
behind a Google login that admits only the email addresses you list. Keep
6b's Tailscale binding as-is; this runs alongside it.

The app has **no login of its own** — Tailscale was the lock. Never publish
port 3001 (or point Caddy at it) without oauth2-proxy in front.

**Prerequisites**

- DNS: in Hostinger's DNS zone for `techtrendwire.com`, add an **A record**
  for `wireassist` pointing at the VPS's public IP. Adding a subdomain record
  does not touch the root records, so the WordPress site is unaffected. Do not
  change the domain's nameservers.
- `ufw` already allows 80/443 (section 0). Caddy (section 6) needs both: 80 for
  the certificate challenge, 443 for traffic.
- Caddy installed from the **official** repo (section 6). If the repo steps fail
  (a mangled paste is enough), `apt install caddy` silently falls back to
  Ubuntu's own, much older package. Check with `apt-cache policy caddy` (the
  candidate should come from `dl.cloudsmith.io`) and `caddy version`.
- Know what already holds 80/443 on the box — Caddy can't start if they're
  taken:

  ```bash
  sudo ss -ltnp | grep -E ':(80|443)\b'
  ```

  If `tailscaled` shows up on `<tailscale-ip>:443` (that's `tailscale serve`,
  HTTPS over the tailnet), leave it alone: it only owns the Tailscale address,
  and the `bind` below lets Caddy coexist on the public one. Anything else on
  80/443 (nginx, Apache, another container) must be dealt with first.

- A Google OAuth client of type **Web application** (separate from the Gmail
  one in section 1): Google Cloud Console → APIs & Services → Credentials →
  Create credentials → OAuth client ID. Under **Authorized redirect URIs** add
  exactly `https://wireassist.techtrendwire.com/oauth2/callback`. If the
  consent screen is in _Testing_ mode, add your email as a test user.

**Step 0 — test the network path before any auth work.** From the work machine,
confirm it can reach the hostname at all (new hostnames are sometimes blocked
by a corporate web filter). With Caddy installed (section 6):

```bash
# Tell Caddy which IP to listen on (the VPS's public IPv4). It must match the
# wireassist A record, and a systemd drop-in keeps it across Caddyfile updates.
PUBLIC_IP=$(curl -4 -s https://ifconfig.me); echo "$PUBLIC_IP"
sudo mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironment=WIREASSIST_PUBLIC_IP=%s\n' "$PUBLIC_IP" |
  sudo tee /etc/systemd/system/caddy.service.d/public-ip.conf
sudo systemctl daemon-reload

# Temporary test config: no app, no login — just proves the path works.
printf 'wireassist.techtrendwire.com {\n\tbind {$WIREASSIST_PUBLIC_IP}\n\trespond "ok"\n}\n' |
  sudo tee /etc/caddy/Caddyfile
sudo WIREASSIST_PUBLIC_IP="$PUBLIC_IP" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl restart caddy     # restart, not reload: the environment changed
sleep 5; curl -sI https://wireassist.techtrendwire.com | head -3     # expect HTTP/2 200
```

Then open `https://wireassist.techtrendwire.com` from the work machine. If you
see `ok`, continue. If it's blocked, stop here: nothing below will help.

**Steps**

```bash
# 1. Secrets — append to .env (never commit it)
python3 -c 'import os,base64; print("OAUTH2_PROXY_COOKIE_SECRET=" + base64.urlsafe_b64encode(os.urandom(32)).decode())' >> .env
cat >> .env <<'EOF'
OAUTH2_PROXY_CLIENT_ID=<from the Google OAuth client>
OAUTH2_PROXY_CLIENT_SECRET=<from the Google OAuth client>
EOF

# 2. Who may sign in: one email per line, nothing else.
cp oauth2-allowed-emails.example.txt oauth2-allowed-emails.txt
$EDITOR oauth2-allowed-emails.txt

# 3. Start the auth service (opt-in compose profile)
docker compose --profile public up -d oauth2-proxy

# 4. Real Caddy config: copy this repo's Caddyfile, validate, then reload.
#    (WIREASSIST_PUBLIC_IP was set in step 0's systemd drop-in; the shell
#    needs it too for `validate`.)
PUBLIC_IP=$(curl -4 -s https://ifconfig.me)
sudo WIREASSIST_PUBLIC_IP="$PUBLIC_IP" caddy validate --config Caddyfile --adapter caddyfile
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Verify**

```bash
# Signed-out request must be redirected to sign-in, not served the app:
curl -sI https://wireassist.techtrendwire.com/ | head -3     # expect 302 → /oauth2/sign_in
curl -sI https://wireassist.techtrendwire.com/api/tasks | head -1   # expect 302, not 200
```

Then open the URL in a browser, sign in with an allow-listed Google account,
and check the dashboard loads and live updates (the `/api/events` stream)
keep arriving. Signing in with a Google account that is _not_ in the list must
be refused. Sign out at `/oauth2/sign_out`.

**Operations**

- Add or remove people: edit `oauth2-allowed-emails.txt`, then
  `docker compose --profile public restart oauth2-proxy`.
- Force everyone to sign in again: change `OAUTH2_PROXY_COOKIE_SECRET` in
  `.env` and restart oauth2-proxy.
- Turn public access off: `docker compose --profile public stop oauth2-proxy`
  and restore a Caddyfile that doesn't proxy to 3001 (or `systemctl stop
caddy`). The Tailscale path keeps working either way.
- The Telegram bot talks to the API over the compose network and is
  unaffected.

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
4. In Google Cloud Console → **Google Auth Platform → Audience**, click
   **Publish app** (Testing → In production). While the consent screen is in
   Testing, Google expires the refresh token after 7 days and every upload
   fails with `invalid_grant: maybe token expired` (the exact error the real
   VPS backup hit). `drive.file` isn't a restricted scope, so publishing needs no Google
   review; you'll just see an "unverified app" warning at sign-in. If the
   token has already expired, publish first, then `rclone config reconnect
<remote-name>:` (same `n` → `rclone authorize` flow as step 3).

Verify with `rclone lsd <remote-name>:` — should list your Drive's
top-level folders (empty output with no error is fine; `lsd` only lists
directories, not files).

Add to `.env` (or export in the cron environment directly — cron doesn't
source `.env` automatically):

```bash
WIREASSIST_BACKUP_PASSPHRASE=<a long random passphrase, not your login password>
WIREASSIST_BACKUP_RCLONE_REMOTE=<remote-name>:<bucket-or-path>/wireassist-backups
```

**Cron entry** (nightly at 3am server time). Run `mkdir -p ~/wireassist-logs`
first — see "Before setting up any cron job below" for why the log path matters:

```bash
crontab -e
# add:
0 3 * * * cd /path/to/WireAssist && set -a && . ./.env && set +a && ./dev/backup.sh >> $HOME/wireassist-logs/wireassist-backup.log 2>&1
```

**Test it once manually** before trusting the cron job — run the same
command by hand and confirm a file lands in your rclone remote. If you
ever need to restore: `rclone copy <remote-path>/<file>.tar.gz.gpg .`,
then `gpg --decrypt <file>.tar.gz.gpg > <file>.tar.gz`, then extract into
a fresh volume the same way `docker run ... busybox tar` was used to
populate it in step 4.

## Before setting up any cron job below: which port?

Every cron entry in this doc targets `WIREASSIST_API_URL=http://localhost:3001`
— **not 3002.** `docker-compose.yml` deliberately does not publish port 3002
(the Hono API) to the host at all; only 3001 (the Next.js command-center,
bound to `127.0.0.1:3001` and your Tailscale IP) is published, and it proxies
`/api/*` through to the API internally (see `next.config.ts` and
`docker-compose.yml`'s own comment). A cron job runs on the host, outside any
container, so it must talk to the published port — 3002 will simply refuse
the connection. (3002 is correct only for a bare-metal/non-Docker deployment
where the Hono server binds that port directly on the host.)

Also replace `/path/to/WireAssist` in every example below with your repo's
real path (e.g. `/home/jason/WireAssist`) — these are templates, not literal
commands to paste in as-is.

**Create the log directory first:** `mkdir -p ~/wireassist-logs`. Every cron
entry in this doc appends its output to `$HOME/wireassist-logs/` — not
`/var/log/`, which earlier versions of this doc used. A non-root user's crontab
can't create files in `/var/log`, and the failure is completely silent: the
shell fails to open the `>>` redirect target before the script ever starts, so
the job never runs and no log is written anywhere to tell you so. This went
unnoticed for five days on the real VPS (including the nightly backup). Same
silent failure if `~/wireassist-logs` doesn't exist, hence creating it first.

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
0 * * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/heartbeat.sh >> $HOME/wireassist-logs/wireassist-heartbeat.log 2>&1
```

Requires `jq` (`sudo apt install -y jq`). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/heartbeat.sh`) to confirm
it skips as expected before trusting it to cron — with no workflow yet at
Stage 4, it should just print a skip line per workflow and exit cleanly.

Outcomes (approved, blocked, or failed) arrive the same way any other run's
outcome does — the Telegram bot already alerts on those regardless of who
triggered the run — so this script doesn't duplicate that notification.

## 9. Proactive daily briefing

`dev/daily-briefing.sh` triggers the Admin Agent's `daily_briefing` task
(inbox triage + calendar review, combined into one digest) on a schedule.
Unlike the heartbeat script above, there's nothing to configure or promote
first — `email_triage`/`calendar_review` already route every proposed
action (drafts, urgent labels, ignore labels) through the normal approval
queue no matter who triggered the task, so there's no extra risk to running
this unattended. Installing the cron entry below **is** the opt-in.

**Cron entry** (once daily — a morning hour works well; adjust to taste):

```bash
crontab -e
# add:
0 7 * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/daily-briefing.sh >> $HOME/wireassist-logs/wireassist-daily-briefing.log 2>&1
```

Requires `jq` (`sudo apt install -y jq`), same as the heartbeat script. Run
it manually once first (`WIREASSIST_API_URL=http://localhost:3001
./dev/daily-briefing.sh`) to confirm it queues successfully before trusting
it to cron.

Optionally set `DAILY_BRIEFING_MAX_EMAILS`/`DAILY_BRIEFING_DAYS_AHEAD` in
the crontab entry to tune the digest window; both default to the API's own
defaults (20 emails, 7 days ahead) when unset.

Outcomes arrive the same way any other task's do — the Telegram bot already
alerts on `daily_briefing_complete`/`task_failed` regardless of who
triggered the run — so this script doesn't duplicate that notification.

## 10. Proactive insights

`dev/proactive-insights.sh` triggers the Admin Agent's `proactive_insights`
task — it reflects on the shared approval/rejection history across every
agent (not just Admin's own) and surfaces any repeated pattern, e.g.
"you've rejected the last 3 proposed Friday moves in a row." Like the daily
briefing above, there's nothing to configure or promote first — the skill
only reads history and phrases a digest, it never proposes or takes an
action itself. If there's no new pattern since the last run, it says so and
skips pinging Telegram — only genuinely new findings result in a push.

**Cron entry** (weekly makes more sense than daily — decision streaks need
time to accumulate):

```bash
crontab -e
# add:
0 8 * * 1 cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/proactive-insights.sh >> $HOME/wireassist-logs/wireassist-proactive-insights.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/proactive-insights.sh`) to
confirm it queues successfully before trusting it to cron.

## 11. Trust-graduation nudges

`dev/trust-graduation-nudges.sh` triggers NixOps's `trust_graduation_nudges`
task — it looks for any workflow that's been approved 3 times in a row at
trust stage 2 (the default — every run needs a human approval) and, for
each one found, proposes graduating it to stage 3 (pre-approved — runs
deliver without asking) through the normal approval queue. Approving that
proposal advances the stage immediately; rejecting it leaves the workflow
at stage 2 and it won't be re-proposed until the streak grows further. If
nothing qualifies, it says so and skips pinging Telegram.

**Cron entry** (weekly, same reasoning as proactive insights above —
approval streaks need time to accumulate):

```bash
crontab -e
# add:
0 8 * * 1 cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/trust-graduation-nudges.sh >> $HOME/wireassist-logs/wireassist-trust-graduation-nudges.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/trust-graduation-nudges.sh`)
to confirm it queues successfully before trusting it to cron.

## 12. Budget warning nudge

`dev/budget-warning.sh` triggers the Admin Agent's `budget_warning_nudge`
task — it checks month-to-date agent spend against a warning threshold
(default 80% of `WIREASSIST_BUDGET_MONTHLY`) and reports whether it's been
crossed. This is separate from the hard block in `assertWithinBudget()`
(which refuses new agent calls once spend reaches 100%) — this nudge is
the earlier, softer heads-up so the cap doesn't come as a surprise. It
never calls the LLM itself (just arithmetic on already-recorded usage), so
it works even before `ANTHROPIC_API_KEY` is configured.

**Cron entry** (daily — once you're over the threshold, spend only climbs
further before the monthly reset, so a same-day heads-up matters):

```bash
crontab -e
# add:
0 9 * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/budget-warning.sh >> $HOME/wireassist-logs/wireassist-budget-warning.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/budget-warning.sh`) to
confirm it queues successfully before trusting it to cron.

## 13. Approval backlog watcher (stale-approval nudges)

`dev/stale-approvals.sh` triggers the Admin Agent's `stale_approvals_nudge`
task, across every agent (not just Admin's own), in three ways:

- Individual requests sitting unresolved for 3+ days without a decision.
- The pending count piling up past a threshold (default 5), even if every
  item is individually fresh.
- Approvals a human already granted that no live process ever acted on —
  a restart orphaned them (see issue #184 and
  `ApprovalQueue.getOrphanedApprovals()`); age alone can't catch these
  since they aren't "waiting," they're lost.

Unlike proactive insights (which reflects on already-_resolved_ history),
this looks at what's still stuck or lost right now. It only reads and
reports — it never resolves anything itself, so there's nothing extra to
gate. If none of the three conditions are met, it says so and skips
pinging Telegram.

**Cron entry** (daily makes more sense here than the weekly cadence above —
an approval blocking a real action is more time-sensitive than a decision
streak):

```bash
crontab -e
# add:
0 9 * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/stale-approvals.sh >> $HOME/wireassist-logs/wireassist-stale-approvals.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/stale-approvals.sh`) to
confirm it queues successfully before trusting it to cron.

## 14. Auto-publish scheduled posts

`dev/auto-publish.sh` triggers the Content Agent's `publish_due_posts` task
— it checks for any scheduled post whose `scheduledAt` time has arrived and
publishes each one to its real platform (Twitter, LinkedIn, Facebook,
Instagram) via the Twitter v2, LinkedIn UGC Posts, and Meta Graph APIs. This
is the one nudge that actually takes real-world action rather than just
reporting — but it's still human-gated: scheduling a post already required
approval (see the Content page's post generator), so this sweep only
executes an already-approved decision once it's due, it never proposes
anything new. A post that fails to publish (bad credentials, a platform API
error) lands in `status: 'failed'` with a diagnostic `errorMessage` and is
**not** retried automatically — check the Content page or the Telegram
alert and intervene manually.

Needs the platform credentials below configured in `.env` before it can
publish anything — without them, due posts will fail with a clear
"missing credential" error rather than silently doing nothing.

**Cron entry** (every 5 minutes — posts have real scheduled times, like a
specific 9am slot, not the vague daily/weekly windows the nudges above
work with, so a coarser cadence would mean posts going out late):

```bash
crontab -e
# add:
*/5 * * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/auto-publish.sh >> $HOME/wireassist-logs/wireassist-auto-publish.log 2>&1
```

No `jq` needed (no request body). **Before enabling this cron entry**,
schedule a real test post via the Content page and manually run
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/auto-publish.sh`) to
confirm it actually publishes and the post's status flips to `published` —
ideally against a throwaway/test account on each platform first, since
none of Twitter or LinkedIn offer a real sandbox for posting (Meta does —
see the credentials section below).

### Getting platform API credentials

**Twitter / X**

1. Go to [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard),
   create a project and app.
2. Set app permissions to **Read + Write**.
3. Generate Access Token & Secret under "Keys and Tokens".
4. Copy all four values (`TWITTER_API_KEY`, `TWITTER_API_SECRET`,
   `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`) to `.env`.

> ⚠️ Free tier = 500 tweets/month. At more than ~16 posts/day sustained,
> you'll need a paid tier.

**LinkedIn**

1. Create an app at [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps).
2. Request the `w_member_social` permission.
3. Complete the OAuth 2.0 flow to get `LINKEDIN_ACCESS_TOKEN`.
4. Find your Person URN: `GET https://api.linkedin.com/v2/me` → copy the
   `id` field as `LINKEDIN_PERSON_URN` (with or without the
   `urn:li:person:` prefix — either works).

> ⚠️ LinkedIn access tokens expire every 60 days. Set a calendar reminder
> to refresh `LINKEDIN_ACCESS_TOKEN`, or publish attempts will start
> failing with an auth error.

**Facebook + Instagram (Meta Graph API)**

1. Create an app at [developers.facebook.com](https://developers.facebook.com/apps),
   add the **Facebook Login** and **Instagram Graph API** products.
2. Get a Page Access Token with `pages_manage_posts` permission via Graph
   API Explorer — this is `META_ACCESS_TOKEN` (shared by both platforms).
3. Find your Facebook Page ID (Page → About → Page ID) as `FACEBOOK_PAGE_ID`.
4. Find your Instagram Business Account ID in Meta Business Suite →
   Settings as `INSTAGRAM_ACCOUNT_ID`.
5. Set `INSTAGRAM_DEFAULT_IMAGE_URL` to a publicly accessible branded
   graphic (1080×1080px recommended) — Instagram feed posts require an
   image, and there's no way to post text-only.

> ℹ️ Meta offers a genuine sandbox for testing: create a Facebook **Test
> App** (a separate App ID in the same Meta Developer account) plus a Test
> Page/Test Instagram Business Account, and mint a short-lived test token
> via Graph API Explorer — verify a real publish there before ever using
> production credentials.

**Publishing as more than one brand/account:** WireAssist tracks which
specific brand a scheduled post is for (`account`, e.g. `nixlevel`,
`techtrendwire`) — see `~/context/product-service-info.md`/`brand-voice.md`
for what those actually are. To let a brand publish through its _own_
Instagram/Facebook credentials instead of falling back to the bare
variables above, add account-scoped versions suffixed with `__<ACCOUNT>`
(the account name, uppercased):

```
META_ACCESS_TOKEN__NIXLEVEL=...
FACEBOOK_PAGE_ID__NIXLEVEL=...
INSTAGRAM_ACCOUNT_ID__NIXLEVEL=...
INSTAGRAM_DEFAULT_IMAGE_URL__NIXLEVEL=...
```

Repeat the full set of four per additional account you want publishing
independently — each needs its own Facebook Page + Instagram Business
Account connected in the Meta Developer app (steps 1-5 above, done once
per brand). Publishing falls back to the bare `META_ACCESS_TOKEN`/etc.
variables for any account with no scoped version set, so you don't need
every account configured before any of them can publish — add them one at
a time as each brand's Meta setup is ready.

Add all ten variables to the `.env` heredoc in section 4 above:
`TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`,
`TWITTER_ACCESS_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN`,
`META_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_ACCOUNT_ID`,
`INSTAGRAM_DEFAULT_IMAGE_URL`. You don't need all of them — only add
credentials for the platforms you actually plan to auto-publish to; a
scheduled post for a platform with no credentials configured will fail
with a clear "missing credential" error rather than blocking the others.

## 15. Objective health-check nudge

`dev/objective-health-check.sh` triggers the Admin Agent's
`objective_health_check_nudge` task — it scans every active Objective and
flags any that have gone 5+ days without any agent activity recorded
against it (or that have never had any activity recorded at all). Unlike
stale-approval nudges (which watch a single stuck request), this watches
whether work toward a stated Objective has kept happening at all. It only
reads and reports — it never changes an Objective's status. If nothing is
stale, it says so and skips pinging Telegram.

**Cron entry** (weekly — Objectives drift slower than an individual
approval sitting unread):

```bash
crontab -e
# add:
0 8 * * 1 cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/objective-health-check.sh >> $HOME/wireassist-logs/wireassist-objective-health-check.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/objective-health-check.sh`)
to confirm it queues successfully before trusting it to cron.

## 16. Stale PR nudge

`dev/stale-prs.sh` triggers the GitHub Dev Agent's `stale_prs_nudge` task —
it scans every open pull request on the configured repo (`WIREASSIST_REPO`,
default `tbmobb813/WireAssist`) and flags any that have gone 5+ days without
an update. It only reads and reports — it never comments, labels, or closes
anything itself. If nothing is stale, it says so and skips pinging
Telegram.

**Cron entry** (daily — a stuck PR is more time-sensitive than a decision
streak, matching stale-approval nudges' reasoning above):

```bash
crontab -e
# add:
0 9 * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/stale-prs.sh >> $HOME/wireassist-logs/wireassist-stale-prs.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/stale-prs.sh`) to confirm
it queues successfully before trusting it to cron — requires GitHub
credentials already configured (section 4).

## 17. Meeting prep

`dev/meeting-prep.sh` triggers the Admin Agent's `meeting_prep` task — it
scans the calendar for meetings starting within the next 2 hours (default)
and, for each one with attendees, drafts prep notes (recent email threads
with them, suggested talking points) via `think()`. Meetings with no
attendees are skipped — there's nothing to prep.

Idempotent by design: each prepped event gets a marker remembered against
it, checked before prepping again — so running this every 30 minutes never
re-prepares the same meeting twice as it drifts through the lookahead
window on successive ticks.

Requires `ANTHROPIC_API_KEY` and Gmail/Calendar credentials already
configured (sections 1 and 4).

**Cron entry** (every 30 minutes — the one nudge in this doc needing
sub-daily cadence, since a meeting needs prep _before_ it happens, not once
a day at an arbitrary time):

```bash
crontab -e
# add:
*/30 * * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/meeting-prep.sh >> $HOME/wireassist-logs/wireassist-meeting-prep.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/meeting-prep.sh`) to
confirm it queues successfully before trusting it to cron.

## 18. Content performance retro

`dev/content-retro.sh` triggers the Content Agent's `content_retro` task —
it analyzes every post published in the last 30 days (default) via
`content_analyze`, then synthesizes a short retro via `think()`: what's
working, what's falling flat, one concrete thing to try next. Unlike the
deterministic nudges above, this always has something to say — even a quiet
period with zero published posts gets a real note about it — so it always
pings Telegram, never silently skips. Real engagement numbers (see section 24) are included next to `content_analyze`'s LLM-guessed
`estimatedEngagement` where available — set up section 24's cron too, or
this retro is working from a guess alone.

Requires `ANTHROPIC_API_KEY` configured, and costs real LLM calls (one
`content_analyze` per published post, plus one `think()` synthesis) — unlike
the free deterministic nudges above.

**Cron entry** (monthly — performance trends need a longer window than any
other nudge in this doc):

```bash
crontab -e
# add:
0 8 1 * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/content-retro.sh >> $HOME/wireassist-logs/wireassist-content-retro.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/content-retro.sh`) to
confirm it queues successfully before trusting it to cron.

## 19. Autonomous pattern-detection nudge

`dev/detect-skill-opportunities.sh` triggers the Admin Agent's
`detect_skill_opportunities` task — it looks across recent freeform
requests (every agent's `freeform.ts` remembers its own request, tagged
`freeform_request`) for a genuine repeated pattern that a purpose-built
skill could handle better than a one-off chat reply.

**This is proposal-only, never autonomous.** If a pattern is found, it's
proposed for approval (gate 1) — nothing happens until Jason approves the
_pattern itself_. Only on approval does it hand off a request to the
relevant agent's own `propose_skill`, which drafts real code and gates
_that_ separately (gate 2), through the exact same Approvals-tab/Telegram
`/approve_<id>` path as every other approval in this codebase. No skill is
ever drafted, and no PR is ever opened, without two separate human
approvals along the way. If nothing is stale, it says so and skips pinging
Telegram.

Requires `ANTHROPIC_API_KEY` already configured.

**Cron entry** (weekly, offset from the existing Monday weekly nudges to
spread cron load — patterns need time to accumulate, same reasoning as
proactive-insights/trust-graduation-nudges above):

```bash
crontab -e
# add:
0 8 * * 2 cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/detect-skill-opportunities.sh >> $HOME/wireassist-logs/wireassist-detect-skill-opportunities.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/detect-skill-opportunities.sh`)
to confirm it queues successfully before trusting it to cron.

## 20. Travel itinerary digest

`dev/travel-itinerary.sh` triggers the Admin Agent's `travel_itinerary_digest`
task — it scans Gmail for travel-confirmation emails and cross-references
Calendar events in the next 14 days (default), then compiles a single
itinerary via `think()`. If nothing looks like travel, it says so and skips
pinging Telegram.

Requires `ANTHROPIC_API_KEY` and Gmail/Calendar credentials already
configured.

**Cron entry** (daily — travel plans can surface any day, same reasoning as
the stale-PR nudge):

```bash
crontab -e
# add:
0 7 * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/travel-itinerary.sh >> $HOME/wireassist-logs/wireassist-travel-itinerary.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/travel-itinerary.sh`) to
confirm it queues successfully before trusting it to cron.

## 21. Expense digest

`dev/expense-digest.sh` triggers the Admin Agent's `expense_digest` task —
it scans Gmail for receipt and invoice emails in the last 30 days (default)
and summarizes spend by category via `think()`. Distinct from
`budget_warning_nudge`, which tracks WireAssist's own AI-spend cap, not real
personal or business expenses. If nothing is found, it says so and skips
pinging Telegram.

Requires `ANTHROPIC_API_KEY` and Gmail credentials already configured.

**Cron entry** (monthly — a spend summary needs a longer window than any
daily/weekly nudge, same reasoning as content-retro above):

```bash
crontab -e
# add:
0 8 2 * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/expense-digest.sh >> $HOME/wireassist-logs/wireassist-expense-digest.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/expense-digest.sh`) to
confirm it queues successfully before trusting it to cron.

## 22. Meeting follow-up

`dev/meeting-followup.sh` triggers the Admin Agent's `meeting_followup`
task — the other half of `meeting_prep` (section 17): instead of prep notes
before a meeting, it drafts a summary and likely action items for meetings
that ended in the last 3 hours (default). Idempotent by the same
remembered-marker trick `meeting_prep` uses, so re-running it never
follows up on the same meeting twice.

Requires `ANTHROPIC_API_KEY` and Gmail/Calendar credentials already
configured.

**Cron entry** (every 30 minutes — same sub-daily cadence as
`meeting-prep.sh`, for the same reason: only useful shortly after a
meeting ends, not once a day at an arbitrary time):

```bash
crontab -e
# add:
*/30 * * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/meeting-followup.sh >> $HOME/wireassist-logs/wireassist-meeting-followup.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/meeting-followup.sh`) to
confirm it queues successfully before trusting it to cron.

## 23. Document drafting (Drive)

Unlike the nudges above, `draft_document` (Admin) is on-demand, not
cron-driven — trigger it via `POST /api/tasks/draft-document` with a
`{"brief": "..."}` body (`title` optional), the same way `send_email` and
`schedule_event` are triggered from the dashboard rather than a schedule.
Given a brief, `think()` drafts the content and creates a Google Doc via a
new `DriveClient`, gated by approval like every other write action.

**One-time note:** this is the first skill to use Google Drive. It needs
the `drive.file` scope (access limited to files WireAssist itself creates —
not your whole Drive), which wasn't part of the original OAuth token. The
first Admin-agent task that touches Drive triggers one automatic
re-authorization — same `hasRequiredScopes()` check that already handles
the Calendar and Sheets scope additions in section 4. No manual action
needed beyond completing that one re-auth prompt when it appears.

## 24. Real post metrics (check-post-metrics)

`dev/check-post-metrics.sh` triggers the Content Agent's
`check_post_metrics` task — for every published post that's hit its 24h or
7d mark since publishing and hasn't been checked for that window yet, it
fetches real engagement (likes/views/comments/shares) from the post's real
platform (Twitter v2, LinkedIn socialActions, Meta Graph API) and stores it
on the post. Section 18's `content_retro` includes these real numbers next
to its LLM-guessed `estimatedEngagement` where available, instead of
relying solely on the guess.

Like auto-publish (section 14) and unlike content-retro, this never calls
the LLM — it's a mechanical fetch-and-store sweep, so it works even before
`ANTHROPIC_API_KEY` is configured. A platform fetch that fails (missing
scope, rate limit, bad credentials) is recorded as an error on that post
rather than retried or allowed to abort the rest of the sweep — check a
post's raw payload on the Content page if its metrics never show up.

**Known real constraints, not guarantees this will work everywhere:**
LinkedIn's `w_member_social` scope (used for publishing) does not include
reading `socialActions` — this will likely fail until the token is granted
a broader scope. Twitter's free/basic API tier often excludes
`public_metrics` reads entirely. Meta (Facebook/Instagram) is the most
likely to work with the same page/IG token already used to publish,
though Instagram still needs `instagram_manage_insights` on that token.

**Cron entry** (hourly — no fixed-minute deadline like a scheduled post
has; this is about catching the 24h/7d marks promptly, not urgency):

```bash
crontab -e
# add:
0 * * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/check-post-metrics.sh >> $HOME/wireassist-logs/wireassist-check-post-metrics.log 2>&1
```

No `jq` needed (no request body). Run it manually once first
(`WIREASSIST_API_URL=http://localhost:3001 ./dev/check-post-metrics.sh`) to
confirm it queues successfully before trusting it to cron.

## 25. Growth scoreboard (content metrics + lead signups + weekly digest)

Three jobs feed one normalized `metrics` table (date, source, metric,
value — see storage.ts) that answers "what's actually working," not just
"what agents did":

- **`dev/sync-scoreboard-metrics.sh`** (Content Agent, `sync_scoreboard_metrics`)
  — daily, rolls up every published post's currently-known engagement
  (from section 24's hourly checks) into today's content totals. No setup
  needed — works off data section 24 already collects.
- **`dev/sync-lead-signups.sh`** (Admin Agent, `sync_lead_signups`) —
  daily, pulls the last 24h of signups from the lead-capture-service's
  Supabase `leads` table. **Requires the Supabase credential setup below
  before it records anything real.**
- **`dev/scoreboard-digest.sh`** (Admin Agent, `scoreboard_digest`) —
  weekly, synthesizes both sources into a short digest: what moved, any
  real win, one suggested action. Requires `ANTHROPIC_API_KEY`; the two
  sync jobs above don't.

### Supabase credential setup (required for lead signups)

`SUPABASE_URL`/`SUPABASE_ANON_KEY` here must be a **read-only** path into
the lead-capture-service's project — never the `service_role`/secret key
that project's own backend uses, which bypasses Row Level Security
entirely and can read or write anything.

1. In the Supabase dashboard for that project (Table Editor → `leads`),
   enable Row Level Security if it isn't already on.
2. Add a SELECT-only policy for the `anon` role (e.g. `USING (true)` — the
   `leads` table holds only email/source/sequence state; scope the policy
   tighter later if that changes).
3. Copy the project's **anon/public** key (Project Settings → API) — not
   `service_role` — into `SUPABASE_ANON_KEY`. Set `SUPABASE_URL` to the
   project's URL (e.g. `https://<ref>.supabase.co`).

Without RLS + that policy, the anon key can read (or, with RLS off
entirely, write) far more than intended — don't skip step 1/2 to save
time.

**Cron entries:**

```bash
crontab -e
# add:
0 6 * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/sync-scoreboard-metrics.sh >> $HOME/wireassist-logs/wireassist-sync-scoreboard-metrics.log 2>&1
0 6 * * * cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/sync-lead-signups.sh >> $HOME/wireassist-logs/wireassist-sync-lead-signups.log 2>&1
0 8 * * 1 cd /path/to/WireAssist && WIREASSIST_API_URL=http://localhost:3001 ./dev/scoreboard-digest.sh >> $HOME/wireassist-logs/wireassist-scoreboard-digest.log 2>&1
```

No `jq` needed (no request bodies). Run each manually once first to
confirm it queues successfully before trusting it to cron — for
`sync-lead-signups.sh`, check the task's actual outcome (not just that it
queued) to confirm the Supabase credential is working, since a missing/bad
credential still returns a 200 queued response and only fails inside the
task itself.

## Updating after a code change

```bash
git pull
docker compose up -d --build
```
