# WireAssist — Setup Guide

## Prerequisites

| Requirement | Version | Needed for                                                  |
| ----------- | ------- | ----------------------------------------------------------- |
| Node.js     | 20.9+   | All packages (Next.js 16 in Command Center requires >=20.9) |
| pnpm        | 11+     | Workspace install (`corepack enable` recommended)           |
| Rust        | 1.70+   | `wireassist/aia` Tauri app only                             |

Install pnpm if needed:

```bash
corepack enable
corepack prepare pnpm@11.3.0 --activate
```

## Clone and install

```bash
cd /path/to/WireAssist
pnpm install
pnpm build:core
pnpm build:admin
```

Command Center and the Admin Agent CLI depend on compiled `dist/` output from core and agent-admin. Run `pnpm build` to build all workspace packages, or build individually as above.

Workspace packages (from `pnpm-workspace.yaml`):

- `wireassist/core` — `@wireassist/core`
- `wireassist/aia` — `synqagent` (frozen desktop app)
- `packages/agents/admin` — `@wireassist/agent-admin`
- `packages/command-center` — `@wireassist/command-center`

Verify linking:

```bash
ls -la wireassist/aia/node_modules/@wireassist/core
# should symlink to ../../../core
```

### Native module: `better-sqlite3`

Command Center and `@wireassist/core` use SQLite via `better-sqlite3`, which must compile during install. If the API exits immediately or you see `Could not locate the bindings file`:

```bash
pnpm approve-builds   # enable better-sqlite3 when prompted
pnpm install
pnpm rebuild better-sqlite3
```

The workspace `pnpm-workspace.yaml` should list `better-sqlite3: true` under `allowBuilds`.

## Environment variables

### Admin Agent & Command Center

Put secrets in the **monorepo root** `.env` (gitignored) — Command Center loads it automatically:

```bash
# /path/to/WireAssist/.env
ANTHROPIC_API_KEY=sk-ant-...
```

You can also `export ANTHROPIC_API_KEY=...` in your shell, or use `packages/command-center/.env.local` for package-only overrides.

### Google Gmail + Calendar

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Gmail API** and **Google Calendar API**.
3. Create **OAuth 2.0 Client ID** (Desktop app or Web with localhost redirect).
4. Download the client JSON.

Place the file at:

```text
~/.wireassist/gmail-credentials.json
```

Or, with a custom base directory:

```bash
export WIREASSIST_HOME=/path/to/config-root
# credentials → $WIREASSIST_HOME/.wireassist/gmail-credentials.json
# token (auto-created) → $WIREASSIST_HOME/.wireassist/gmail-token.json
```

On first agent startup, a browser OAuth flow runs and saves the token. Gmail and Calendar share this token; Calendar scopes are included in the Gmail auth flow.

### Desktop app (frozen)

The Tauri package under `wireassist/aia/` is shelved. Skip this section unless you are reviving **WireAssist Desktop**.

## Run Command Center

```bash
pnpm build:core
pnpm build:admin
pnpm --filter @wireassist/command-center dev
```

| Service | URL                          |
| ------- | ---------------------------- |
| Web UI  | http://localhost:3001        |
| API     | http://localhost:3002        |
| Health  | http://localhost:3002/health |

The Next.js app proxies `/api/*` to the Hono API (see `packages/command-center/next.config.ts`). Command Center uses **Next.js 16** and **React 19**.

Optional port overrides (must match across API, Next rewrites, and `wait-on`):

```bash
export API_PORT=3003
export WEB_PORT=3001
pnpm --filter @wireassist/command-center dev
```

Root `.env` is loaded by the API on startup. Variables already set in your shell are **not** overwritten (e.g. `export ANTHROPIC_API_KEY=...` wins over `.env`).

If you see `EADDRINUSE` on port 3002 or 3001, a previous dev process is still running. `pnpm dev:command-center` runs pre-steps to free both ports; you can also run `fuser -k 3002/tcp` or `fuser -k 3001/tcp` manually.

### Production start (Command Center)

After `pnpm build:command-center`, run **both** the API and the web server (same as dev):

```bash
pnpm --filter @wireassist/command-center start
```

This runs `start:api` (Hono) and `start:web` (`next start`) via `concurrently`.

SQLite state for approvals and memory defaults to `~/.wireassist/wireassist.db`.

### UI routes

- `/` — dashboard, run triage / calendar tasks
- `/approvals` — approve or reject agent actions
- `/chat` — freeform agent instructions
- `/memory` — browse agent memory store

## Run Admin Agent demo (CLI)

No web UI; approvals via terminal `[y/n]`:

```bash
pnpm --filter @wireassist/agent-admin build
node packages/agents/admin/dist/demo.js
```

Requires the same Google credentials and `ANTHROPIC_API_KEY` as Command Center.

## Run @wireassist/core alone

```bash
pnpm dev:core
# watches TypeScript in wireassist/core
```

Run tests:

```bash
pnpm test:core
```

## Build individual packages

```bash
pnpm build:core
pnpm --filter @wireassist/agent-admin build
pnpm --filter @wireassist/command-center build
pnpm build:aia
```

## Troubleshooting

### `pnpm install` fails on missing packages

Ensure `pnpm-workspace.yaml` only lists existing directories (`wireassist/*`, `packages/agents/admin`, `packages/command-center`). Do not add `packages/core` or `packages/aia` — those paths are not used.

### Calendar 403 / insufficient scopes

Delete `~/.wireassist/gmail-token.json` and re-run; the agent will prompt for re-authorization with Calendar scopes.

### OAuth port in use

Another process is bound to the redirect URI port from your Google client config. Stop it and retry.

### `@wireassist/core` changes not reflected

Rebuild core after changes: `pnpm build:core`, or use `pnpm dev:core` while developing dependents.

### Network timeouts during install

Root `.npmrc` sets `network-timeout=100000` and `child-concurrency=2` for slower networks.
