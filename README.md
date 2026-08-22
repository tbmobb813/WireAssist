# WireAssist

WireAssist is a TechTrendWire product.

A pnpm monorepo for a privacy-oriented AI platform with a multi-provider chat engine, an agent workforce that can triage email and manage calendar with human-in-the-loop approvals, and a Command Center dashboard.

## What’s in this repo

| Package                      | Path                        | Purpose                                                                         |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `@wireassist/core`           | `wireassist/core/`          | Shared AI engine, storage, agents, MCP, approval queue, memory                  |
| `synqagent` (frozen)         | `wireassist/aia/`           | Desktop app (Tauri); shelved — revive as WireAssist Desktop if needed           |
| `@wireassist/agent-admin`    | `packages/agents/admin/`    | Admin agent — Gmail + Google Calendar + Sheets via Claude                       |
| `@wireassist/agent-content`  | `packages/agents/content/`  | Content agent — generates, schedules, and manages content via TrendPost         |
| `@wireassist/agent-research` | `packages/agents/research/` | Research agent — web search and synthesis                                       |
| `@wireassist/agent-ops`      | `packages/agents/ops/`      | NixOps agent — runs business workflows (DATA loop) behind a trust-stage ladder  |
| `@wireassist/agent-gtm`      | `packages/agents/gtm/`      | GTM agent — go-to-market strategy and psychological marketing tactics           |
| `@wireassist/trendpost-mcp`  | `packages/trendpost-mcp/`   | MCP server — content generation and scheduling tools used by the Content agent  |
| `@wireassist/command-center` | `packages/command-center/`  | Next.js dashboard + Hono API to run agents and review approvals                 |
| `@wireassist/telegram-bot`   | `packages/telegram-bot/`    | Telegram surface — status, budget, approvals, and workflow runs from your phone |
| `@wireassist/marketing`      | `packages/marketing/`       | Public marketing site — landing page, pricing, waitlist                         |

## Repository layout

```
WireAssist/
├── wireassist/
│   ├── core/                 # @wireassist/core
│   └── aia/                  # desktop app (frozen)
├── packages/
│   ├── agents/
│   │   ├── admin/            # @wireassist/agent-admin
│   │   ├── content/          # @wireassist/agent-content
│   │   ├── research/         # @wireassist/agent-research
│   │   ├── ops/               # @wireassist/agent-ops (NixOps)
│   │   └── gtm/               # @wireassist/agent-gtm
│   ├── trendpost-mcp/         # @wireassist/trendpost-mcp
│   ├── command-center/        # @wireassist/command-center
│   ├── telegram-bot/          # @wireassist/telegram-bot
│   └── marketing/             # @wireassist/marketing
├── dev/                       # backup.sh, heartbeat.sh — VPS cron scripts
├── docs/                      # Setup, deployment, architecture, contributing
├── Dockerfile, docker-compose.yml, Caddyfile   # self-hosted deployment
├── pnpm-workspace.yaml
└── package.json
```

## Prerequisites

- **Node.js** 22.13+ (pnpm 11's pinned version uses `node:sqlite` internally, which is Node 22.13+ only — applies everywhere, not just Command Center)
- **pnpm** 11+ (see `packageManager` in root `package.json`)
- **Rust** 1.70+ (only if reviving the Tauri desktop app)
- **Anthropic API key** (for every agent)
- **Google Cloud OAuth credentials** (for Gmail, Calendar, and Sheets tools)

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
- **Sheets** — read/write spreadsheets referenced by ops workflows
- **Approval queue** — sensitive actions require explicit approval in the UI or CLI
- **MCP tools** — `gmail_*`, `calendar_*`, and `sheets_*` handlers registered in `setupAdminMCP`

Gmail, Calendar, and Sheets share one OAuth token stored under `$WIREASSIST_HOME/.wireassist/` (default `~/.wireassist/gmail-token.json`).

## Other agents

- **Content** — generates and schedules posts via TrendPost (`@wireassist/trendpost-mcp`)
- **Research** — web search and synthesis
- **NixOps** — runs real business workflows (the DATA loop: Diagnose, Assemble, Take action, Assess) behind a per-workflow trust-stage ladder (2 = approve everything, 3 = pre-approved, 4 = unattended/cron-triggered — see `dev/heartbeat.sh`)
- **GTM** — go-to-market strategy and psychological marketing tactics

All agents are reachable from the Command Center dashboard and, for status/budget/approvals/workflow runs, from the Telegram bot (`packages/telegram-bot`).

## Configuration

| Variable                    | Used by                       | Description                                                   |
| --------------------------- | ----------------------------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | Every agent, core providers   | Claude API access                                             |
| `WIREASSIST_HOME`           | Gmail/Calendar/Sheets clients | Base directory for `.wireassist/` config (default: user home) |
| `TELEGRAM_BOT_TOKEN`        | Telegram bot                  | From @BotFather                                               |
| `TELEGRAM_CHAT_ID`          | Telegram bot                  | Your chat id — all other chats are ignored                    |
| `WIREASSIST_BUDGET_MONTHLY` | Command Center                | Monthly spend cap shown in `/budget`                          |
| `OPENAI_API_KEY`, etc.      | Core providers                | Optional; see core provider docs                              |

Place Google OAuth client JSON at:

`$WIREASSIST_HOME/.wireassist/gmail-credentials.json`

Details: [docs/SETUP.md](docs/SETUP.md).

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — install, Google OAuth, env vars, per-package dev
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — self-hosted VPS deployment (Docker, backups, Telegram alerting, heartbeat cron)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — packages, data flow, agent platform
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — development guidelines

Historical phase notes and early monorepo-migration docs live under `docs/archive/` — they describe earlier milestones, reference paths that no longer exist, and aren't kept up to date. Prefer this README and `docs/` for the current layout.

## License

MIT
