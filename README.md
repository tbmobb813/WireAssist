# WireAssist

WireAssist is a TechTrendWire product.

A pnpm monorepo for a privacy-oriented AI platform with a multi-provider chat engine, an agent workforce that can triage email and manage calendar with human-in-the-loop approvals, and a Command Center dashboard.

## What’s in this repo

| Package                      | Path                       | Purpose                                                               |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `@wireassist/core`           | `wireassist/core/`         | Shared AI engine, storage, agents, MCP, approval queue, memory        |
| `synqagent` (frozen)         | `wireassist/aia/`          | Desktop app (Tauri); shelved — revive as WireAssist Desktop if needed |
| `@wireassist/agent-admin`    | `packages/agents/admin/`   | Admin agent — Gmail + Google Calendar via Claude                      |
| `@wireassist/command-center` | `packages/command-center/` | Next.js dashboard + Hono API to run agents and review approvals       |

## Repository layout

```
WireAssist/
├── wireassist/
│   ├── core/                 # @wireassist/core
│   └── aia/                  # desktop app (frozen)
├── packages/
│   ├── agents/admin/         # @wireassist/agent-admin
│   └── command-center/       # @wireassist/command-center
├── docs/                     # Setup, architecture, contributing
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- **Node.js** 20.9+ (required for Command Center / Next.js 16; 18+ may work for core only)
- **pnpm** 11+ (see `packageManager` in root `package.json`)
- **Rust** 1.70+ (only if reviving the Tauri desktop app)
- **Anthropic API key** (for the Admin Agent)
- **Google Cloud OAuth credentials** (for Gmail + Calendar tools)

## Quick start

```bash
git clone <repo-url> WireAssist
cd WireAssist
pnpm install
pnpm build:core
pnpm build:admin
```

### Command Center (agents + UI)

Runs the API on port **3002** and the web UI on **3001**. Build `@wireassist/core` and `@wireassist/agent-admin` first (they resolve to `dist/`).

```bash
# Required for Admin Agent
export ANTHROPIC_API_KEY=sk-ant-...

# Optional: override config directory (default: ~/.wireassist)
# export WIREASSIST_HOME=/path/to/home

pnpm build:core
pnpm build:admin
pnpm --filter @wireassist/command-center dev
```

Open [http://localhost:3001](http://localhost:3001). On first run, complete Google OAuth when prompted (credentials must be in place — see [docs/SETUP.md](docs/SETUP.md)).

### Admin Agent CLI demo

Interactive demo with terminal `[y/n]` approvals (no Command Center UI):

```bash
pnpm --filter @wireassist/agent-admin build
cd packages/agents/admin && node dist/demo.js
```

### Desktop app (frozen)

The Tauri desktop package under `wireassist/aia/` is shelved. Do not treat it as an active product surface. If it is revived, it ships as **WireAssist Desktop**.

## Common commands

| Command                                        | Description                                             |
| ---------------------------------------------- | ------------------------------------------------------- |
| `pnpm install`                                 | Install all workspace dependencies                      |
| `pnpm build`                                   | Build all active packages (excludes frozen desktop app) |
| `pnpm build:core`                              | Build `@wireassist/core` only                           |
| `pnpm dev`                                     | Run `dev` in all packages (parallel)                    |
| `pnpm dev:core`                                | Watch-build core                                        |
| `pnpm test`                                    | Run tests across packages                               |
| `pnpm --filter @wireassist/command-center dev` | Command Center API + web                                |

## Admin Agent capabilities

The Admin Agent uses Claude and real Google APIs (via `googleapis`):

- **Email triage** — list threads, categorize, propose drafts and labels
- **Calendar review** — list events, suggest scheduling changes
- **Approval queue** — sensitive actions require explicit approval in the UI or CLI
- **MCP tools** — `gmail_*` and `calendar_*` handlers registered in `setupAdminMCP`

Gmail and Calendar share one OAuth token stored under `$WIREASSIST_HOME/.wireassist/` (default `~/.wireassist/gmail-token.json`).

## Configuration

| Variable               | Used by                     | Description                                                   |
| ---------------------- | --------------------------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | Admin Agent, core providers | Claude API access                                             |
| `WIREASSIST_HOME`      | Gmail/Calendar clients      | Base directory for `.wireassist/` config (default: user home) |
| `OPENAI_API_KEY`, etc. | Core providers              | Optional; see core provider docs                              |

Place Google OAuth client JSON at:

`$WIREASSIST_HOME/.wireassist/gmail-credentials.json`

Details: [docs/SETUP.md](docs/SETUP.md).

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — install, Google OAuth, env vars, per-package dev
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — packages, data flow, agent platform
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — development guidelines

Legacy phase notes (`PHASE_*.md`, `MONOREPO_SETUP.md`) describe earlier milestones and may reference old paths; prefer this README and `docs/` for current layout.

## License

MIT
