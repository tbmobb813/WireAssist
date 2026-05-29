# Nolta (SynqWorks)

A pnpm monorepo for **SynqWorks** — a privacy-oriented AI platform with a multi-provider chat engine, a desktop assistant, and an agent workforce that can triage email and manage calendar with human-in-the-loop approvals.

The repository name is **Nolta**; product surfaces use **SynqWorks**.

## What’s in this repo

| Package | Path | Purpose |
|---------|------|---------|
| `@synqworks/core` | `synqworks/core/` | Shared AI engine, storage, agents, MCP, approval queue, memory |
| `ai-assist` | `synqworks/aia/` | Tauri + React desktop app for local multi-provider chat |
| `@synqworks/agent-admin` | `packages/agents/admin/` | Admin agent — Gmail + Google Calendar via Claude |
| `@synqworks/command-center` | `packages/command-center/` | Next.js dashboard + Hono API to run agents and review approvals |

## Repository layout

```
Nolta/
├── synqworks/
│   ├── core/                 # @synqworks/core
│   └── aia/                  # ai-assist (Tauri)
├── packages/
│   ├── agents/admin/         # @synqworks/agent-admin
│   └── command-center/       # @synqworks/command-center
├── docs/                     # Setup, architecture, contributing
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- **Node.js** 20.9+ (required for Command Center / Next.js 16; 18+ may work for core and AIA only)
- **pnpm** 11+ (see `packageManager` in root `package.json`)
- **Rust** 1.70+ (only for the Tauri desktop app)
- **Anthropic API key** (for the Admin Agent)
- **Google Cloud OAuth credentials** (for Gmail + Calendar tools)

## Quick start

```bash
git clone <repo-url> Nolta
cd Nolta
pnpm install
pnpm build:core
pnpm build:admin
```

### Command Center (agents + UI)

Runs the API on port **3002** and the web UI on **3001**. Build `@synqworks/core` and `@synqworks/agent-admin` first (they resolve to `dist/`).

```bash
# Required for Admin Agent
export ANTHROPIC_API_KEY=sk-ant-...

# Optional: override config directory (default: ~/.synqworks)
# export SYNQWORKS_HOME=/path/to/home

pnpm build:core
pnpm build:admin
pnpm --filter @synqworks/command-center dev
```

Open [http://localhost:3001](http://localhost:3001). On first run, complete Google OAuth when prompted (credentials must be in place — see [docs/SETUP.md](docs/SETUP.md)).

### Admin Agent CLI demo

Interactive demo with terminal `[y/n]` approvals (no Command Center UI):

```bash
pnpm --filter @synqworks/agent-admin build
cd packages/agents/admin && node dist/demo.js
```

### AI Assist (desktop)

```bash
pnpm dev:aia
# or
pnpm --filter ai-assist dev
```

Requires Rust and Tauri toolchain — see [docs/SETUP.md](docs/SETUP.md).

## Common commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | Build all packages |
| `pnpm build:core` | Build `@synqworks/core` only |
| `pnpm build:aia` | Build desktop app only |
| `pnpm dev` | Run `dev` in all packages (parallel) |
| `pnpm dev:core` | Watch-build core |
| `pnpm dev:aia` | Vite dev server for AIA |
| `pnpm test` | Run tests across packages |
| `pnpm --filter @synqworks/command-center dev` | Command Center API + web |

## Admin Agent capabilities

The Admin Agent uses Claude and real Google APIs (via `googleapis`):

- **Email triage** — list threads, categorize, propose drafts and labels
- **Calendar review** — list events, suggest scheduling changes
- **Approval queue** — sensitive actions require explicit approval in the UI or CLI
- **MCP tools** — `gmail_*` and `calendar_*` handlers registered in `setupAdminMCP`

Gmail and Calendar share one OAuth token stored under `$SYNQWORKS_HOME/.synqworks/` (default `~/.synqworks/gmail-token.json`).

## Configuration

| Variable | Used by | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Admin Agent, core providers | Claude API access |
| `SYNQWORKS_HOME` | Gmail/Calendar clients | Base directory for `.synqworks/` config (default: user home) |
| `OPENAI_API_KEY`, etc. | AIA / core providers | Optional; see core provider docs |

Place Google OAuth client JSON at:

`$SYNQWORKS_HOME/.synqworks/gmail-credentials.json`

Details: [docs/SETUP.md](docs/SETUP.md).

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — install, Google OAuth, env vars, per-package dev
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — packages, data flow, agent platform
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — development guidelines

Legacy phase notes (`PHASE_*.md`, `MONOREPO_SETUP.md`) describe earlier milestones and may reference old paths; prefer this README and `docs/` for current layout.

## License

MIT
