# SynqWorks / Nolta — Setup Guide

## Prerequisites

| Requirement | Version | Needed for |
|-------------|---------|------------|
| Node.js | 18+ | All packages |
| pnpm | 11+ | Workspace install (`corepack enable` recommended) |
| Rust | 1.70+ | `synqworks/lai` Tauri app only |

Install pnpm if needed:

```bash
corepack enable
corepack prepare pnpm@11.3.0 --activate
```

## Clone and install

```bash
cd /path/to/Nolta
pnpm install
pnpm build:core
pnpm build:admin
```

Command Center and the Admin Agent CLI depend on compiled `dist/` output from core and agent-admin. Run `pnpm build` to build all workspace packages, or build individually as above.

Workspace packages (from `pnpm-workspace.yaml`):

- `synqworks/core` — `@synqworks/core`
- `synqworks/lai` — `linux-ai-assistant`
- `packages/agents/admin` — `@synqworks/agent-admin`
- `packages/command-center` — `@synqworks/command-center`

Verify linking:

```bash
ls -la synqworks/lai/node_modules/@synqworks/core
# should symlink to ../../../core
```

### Native module: `better-sqlite3`

Command Center and `@synqworks/core` use SQLite via `better-sqlite3`, which must compile during install. If the API exits immediately or you see `Could not locate the bindings file`:

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
# /path/to/Nolta/.env
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
~/.synqworks/gmail-credentials.json
```

Or, with a custom base directory:

```bash
export SYNQWORKS_HOME=/path/to/config-root
# credentials → $SYNQWORKS_HOME/.synqworks/gmail-credentials.json
# token (auto-created) → $SYNQWORKS_HOME/.synqworks/gmail-token.json
```

On first agent startup, a browser OAuth flow runs and saves the token. Gmail and Calendar share this token; Calendar scopes are included in the Gmail auth flow.

### LAI desktop (optional providers)

Create `synqworks/lai/.env.local` (or export in shell) as needed:

```bash
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
# etc.
```

## Run Command Center

```bash
pnpm build:core
pnpm build:admin
pnpm --filter @synqworks/command-center dev
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3001 |
| API | http://localhost:3002 |
| Health | http://localhost:3002/health |

The Next.js app proxies `/api/*` to the Hono API (see `packages/command-center/next.config.ts`). Command Center uses **Next.js 16** and **React 19**.

If the API fails with `EADDRINUSE` on port 3002, a previous API process is still running. `pnpm dev:api` runs a pre-step to free the port; you can also run `fuser -k 3002/tcp` manually.

SQLite state for approvals and memory defaults to `~/.synqworks/synqworks.db`.

### UI routes

- `/` — dashboard, run triage / calendar tasks
- `/approvals` — approve or reject agent actions
- `/chat` — freeform agent instructions
- `/memory` — browse agent memory store

## Run Admin Agent demo (CLI)

No web UI; approvals via terminal `[y/n]`:

```bash
pnpm --filter @synqworks/agent-admin build
node packages/agents/admin/dist/demo.js
```

Requires the same Google credentials and `ANTHROPIC_API_KEY` as Command Center.

## Run @synqworks/core alone

```bash
pnpm dev:core
# watches TypeScript in synqworks/core
```

Run tests:

```bash
pnpm test:core
```

## Run Linux AI Assistant (Tauri)

```bash
# Install Rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

pnpm dev:lai
```

Full desktop build:

```bash
pnpm build:lai
pnpm --filter linux-ai-assistant tauri build
```

## Build individual packages

```bash
pnpm build:core
pnpm --filter @synqworks/agent-admin build
pnpm --filter @synqworks/command-center build
pnpm build:lai
```

## Troubleshooting

### `pnpm install` fails on missing packages

Ensure `pnpm-workspace.yaml` only lists existing directories (`synqworks/*`, `packages/agents/admin`, `packages/command-center`). Do not add `packages/core` or `packages/lai` — those paths are not used.

### Calendar 403 / insufficient scopes

Delete `~/.synqworks/gmail-token.json` and re-run; the agent will prompt for re-authorization with Calendar scopes.

### OAuth port in use

Another process is bound to the redirect URI port from your Google client config. Stop it and retry.

### `@synqworks/core` changes not reflected

Rebuild core after changes: `pnpm build:core`, or use `pnpm dev:core` while developing dependents.

### Network timeouts during install

Root `.npmrc` sets `network-timeout=100000` and `child-concurrency=2` for slower networks.
