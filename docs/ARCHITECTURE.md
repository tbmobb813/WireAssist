# Architecture

## Overview

**WireAssist** is a TechTrendWire product: a local-first AI stack with a shared core library, a Command Center, and an agent layer that performs real-world tasks (email, calendar) behind an approval gate. The desktop app under `wireassist/aia/` is frozen.

```mermaid
flowchart TB
  subgraph clients [Clients]
    CC[Command Center UI<br/>Next.js :3001]
    TG[Telegram bot]
    AIA[ai-assist<br/>Tauri + React]
    CLI[Admin demo CLI]
  end

  subgraph agents [Agents]
    AA[AdminAgent]
    CA[ContentAgent]
    RA[ResearchAgent]
    OA[NixOpsAgent]
    GA[GtmAgent]
  end

  subgraph core [@wireassist/core]
    MCP[MCPClient]
    AQ[ApprovalQueue]
    MS[MemoryStore]
    EB[EventBus]
    AI[AIClient / Providers]
  end

  subgraph external [External APIs / services]
    G[Gmail + Calendar + Sheets]
    CL[Anthropic Claude]
    TP[TrendPost MCP]
  end

  CC -->|REST + SSE| API[Hono API :3002]
  TG -->|REST + SSE| API
  API --> AA & CA & RA & OA & GA
  CLI --> AA
  AIA --> AI
  AA --> MCP
  AA & CA & RA & OA & GA --> AQ
  AA & CA & RA & OA & GA --> MS
  AA & CA & RA & OA & GA --> EB
  AA & CA & RA & OA & GA --> CL
  MCP --> G
  CA --> TP
```

`POST /api/tasks/*` endpoints are additionally gated by a license tier (`trial` < `solo` < `operator` < `workforce`), checked per-endpoint against a row in the same SQLite DB — see [Licensing](#licensing) below.

## Packages

### `@wireassist/core` (`wireassist/core/`)

Foundation library used by AIA and WireAssist agents.

**Original AIA responsibilities:**

- Multi-provider AI (`AIClient`, OpenAI, Anthropic, Gemini, Ollama)
- SQLite storage with FTS search
- Context building (files, git, workspace)
- Privacy controls and streaming

**WireAssist agent platform additions:**

| Module      | Role                                              |
| ----------- | ------------------------------------------------- |
| `agents/`   | Agent types and registry                          |
| `mcp/`      | `MCPClient` — register and dispatch tool handlers |
| `approval/` | `ApprovalQueue` — persist pending human approvals |
| `memory/`   | `MemoryStore` — agent memory in SQLite            |
| `events/`   | `EventBus` — task lifecycle events for UI/SSE     |

Entry point: `wireassist/core/src/index.ts`.

### `ai-assist` (`wireassist/aia/`)

Native Linux desktop app (Tauri + React + Vite).

- Consumes `@wireassist/core` for chat and providers
- System tray, shortcuts, CLI tooling
- Independent from Command Center / Admin Agent

### `@wireassist/agent-admin` (`packages/agents/admin/`)

Claude-powered agent for administrative work.

| File                 | Role                                                   |
| -------------------- | ------------------------------------------------------ |
| `admin-agent.ts`     | Task handlers: email triage, calendar review, freeform |
| `base-agent.ts`      | Anthropic completion helper                            |
| `gmail-client.ts`    | OAuth + Gmail API                                      |
| `calendar-client.ts` | Reuses Gmail OAuth token for Calendar API              |
| `mcp-setup.ts`       | Registers `gmail_*` and `calendar_*` MCP tools         |
| `task-factory.ts`    | Builds typed `AgentTask` objects                       |

**Auth paths** (shared across `gmail-client.ts`, `calendar-client.ts`, `sheets-client.ts`):

```ts
const HOME_PATH = process.env.WIREASSIST_HOME ?? os.homedir();
// $HOME_PATH/.wireassist/gmail-credentials.json
// $HOME_PATH/.wireassist/gmail-token.json
```

Sheets is the same OAuth client/token as Gmail and Calendar — a token generated before Sheets support was added is missing the `spreadsheets` scope, which `gmail.authenticate()` detects automatically and re-runs the OAuth flow.

### Other agents

| Package                      | Path                        | Role                                                                                                                                                                                                             |
| ---------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wireassist/agent-content`  | `packages/agents/content/`  | Generates and schedules posts. Uses `@wireassist/trendpost-mcp` for storage and MCP tools.                                                                                                                       |
| `@wireassist/agent-research` | `packages/agents/research/` | Web search and synthesis into structured findings.                                                                                                                                                               |
| `@wireassist/agent-ops`      | `packages/agents/ops/`      | NixOps — runs real business workflows (defined as markdown in `context/workflows/*.md`) through the DATA loop (Diagnose, Assemble, Take action, Assess), gated by a per-workflow trust stage (`trust-stage.ts`). |
| `@wireassist/agent-gtm`      | `packages/agents/gtm/`      | Go-to-market strategy and psychological marketing tactics; can pre-fill from a project's own repo docs.                                                                                                          |

**NixOps trust ladder** (`packages/agents/ops/src/trust-stage.ts`), stored per-workflow in `$WIREASSIST_HOME/.wireassist/ops-trust.json`:

| Stage | Meaning                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2     | Default. Every run requires human approval before delivery.                                                                                                                                                  |
| 3     | Pre-approved — runs deliver without asking, but still human-triggered.                                                                                                                                       |
| 4     | Same code path as 3, but meant to be triggered unattended by `dev/heartbeat.sh` on a cron. Advancing a workflow to 4 is a deliberate, per-workflow decision — nothing in the codebase does it automatically. |

### `@wireassist/trendpost-mcp` (`packages/trendpost-mcp/`)

MCP server backing the Content agent — SQLite-backed storage for scheduled/published posts and ideas, plus the MCP tool handlers the Content agent calls.

### `@wireassist/telegram-bot` (`packages/telegram-bot/`)

Zero-dependency long-polling Telegram client (`src/index.ts`). Three independent loops:

- `pollLoop()` — slash commands (`/status`, `/budget`, `/approvals`, `/approve`, `/reject`, `/workflows`, `/run`, `/ask`), calling the same Command Center API as the dashboard.
- `sseLoop()` — subscribes to `/api/events`, pushes agent results/approval requests/failures back to chat.
- `healthLoop()` — polls `/health` every 60s independently of the SSE connection; alerts after 3 consecutive failures so a dead API process doesn't go unnoticed.

### `@wireassist/command-center` (`packages/command-center/`)

Operational UI for running agents.

| Layer | Tech                       | Port |
| ----- | -------------------------- | ---- |
| Web   | Next.js 16                 | 3001 |
| API   | Hono + `@hono/node-server` | 3002 |

**API highlights:**

- `POST /api/tasks/triage-email` / `POST /api/tasks/review-calendar` — Admin agent
- `POST /api/tasks/generate-post` / `POST /api/tasks/generate-plan` — Content agent
- `POST /api/tasks/research-topic` / `POST /api/tasks/synthesize` — Research agent
- `POST /api/tasks/ops-workflow` / `POST /api/tasks/ops-freeform` — NixOps agent (workforce tier)
- `POST /api/tasks/gtm/strategy` / `POST /api/tasks/gtm/psych` — GTM agent (operator tier)
- `GET/POST /api/ops/trust/:workflow` — read/set a workflow's trust stage
- `POST /api/tasks/freeform` — ad-hoc instruction, routed to the right agent automatically
- `GET/POST /api/approvals/*` — approval queue
- `GET/POST /api/portfolio/*` — weekly-focus gate and project tracking (Zones 1–2)
- `GET /api/budget` — month-to-date spend vs. `WIREASSIST_BUDGET_MONTHLY`
- `GET /api/license/status` / `POST /api/license/activate` — license tier (see Licensing below)
- `GET /api/events` — SSE stream of agent events; `GET /api/activity` — recent event log for hydration

Bootstrap wires `setupAdminMCP` and each other agent's setup into their respective agent instances, all sharing one SQLite DB at `~/.wireassist/wireassist.db`.

## Licensing

Most `POST /api/tasks/*` endpoints (and a few `GET`s) are gated behind `tierGate(minTier)` in `server.ts`, checked against `currentTier()` — the most recent non-expired row in the `licenses` table (`trial` < `solo` < `operator` < `workforce`; `trial` if no row exists). Real activation goes through `POST /api/license/activate`, which validates a key against the LemonSqueezy API and maps its variant ID to a tier via `LS_VARIANT_SOLO`/`LS_VARIANT_OPERATOR`/`LS_VARIANT_WORKFORCE` env vars.

For a self-hosted single-owner deployment, there is no external LemonSqueezy call required to use your own instance — insert a `workforce`-tier row directly into the `licenses` table (same SQLite DB, no payment, fully reversible). See `docs/DEPLOYMENT.md`.

## Deployment

Self-hosted VPS deployment (Docker Compose, off-box backups, Telegram downtime alerting, the Stage-4 heartbeat cron) is covered in `docs/DEPLOYMENT.md`, not duplicated here. Summary of what's involved:

- `Dockerfile` / `docker-compose.yml` — `command-center` and `telegram-bot` services, one named volume (`wireassist-data`) at `WIREASSIST_HOME=/data` holding the SQLite DB and OAuth tokens.
- `Caddyfile` — optional TLS termination for a real domain; the app itself only binds to loopback.
- `dev/backup.sh` — encrypted (`gpg`), off-box (`rclone`) volume backups.
- `dev/heartbeat.sh` — the Stage-4 unattended trigger described above.

## Monorepo layout

```
WireAssist/
├── wireassist/
│   ├── core/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── providers/
│   │   │   ├── storage/
│   │   │   ├── portfolio/            # PortfolioStore — Zones 1-2 weekly focus/WIP
│   │   │   ├── agents/ memory/ approval/ mcp/ events/
│   │   │   └── ...
│   │   └── package.json          # @wireassist/core
│   └── aia/
│       ├── src/                  # React UI
│       ├── src-tauri/            # Rust backend
│       └── package.json          # ai-assist
├── packages/
│   ├── agents/
│   │   ├── admin/                # @wireassist/agent-admin
│   │   ├── content/               # @wireassist/agent-content
│   │   ├── research/              # @wireassist/agent-research
│   │   ├── ops/                    # @wireassist/agent-ops (NixOps; context/workflows/*.md)
│   │   └── gtm/                    # @wireassist/agent-gtm
│   ├── trendpost-mcp/             # @wireassist/trendpost-mcp
│   ├── command-center/            # @wireassist/command-center
│   ├── telegram-bot/              # @wireassist/telegram-bot
│   └── marketing/                 # @wireassist/marketing (public site)
├── dev/
│   ├── backup.sh                  # off-box encrypted volume backups (cron)
│   └── heartbeat.sh               # Stage-4 unattended workflow trigger (cron)
├── docs/
├── Dockerfile, docker-compose.yml, Caddyfile
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Workspace configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'wireassist/core'
  - 'wireassist/aia'
  - 'packages/agents/admin'
  - 'packages/agents/content'
  - 'packages/agents/research'
  - 'packages/agents/ops'
  - 'packages/agents/gtm'
  - 'packages/trendpost-mcp'
  - 'packages/command-center'
  - 'packages/telegram-bot'
  - 'packages/marketing'
```

Internal dependencies use `workspace:*`:

```json
"@wireassist/core": "workspace:*"
```

`better-sqlite3` and `@swc/core` are listed under `onlyBuiltDependencies` because they compile/run native postinstall scripts.

## Agent task flow

1. Client (Command Center UI, Telegram bot, CLI, or `dev/heartbeat.sh` for Stage-4 NixOps runs) queues a task (`AgentTask` from that agent's task factory).
2. The agent's `run()` emits `agent:task_started` on `EventBus`.
3. Agent calls Claude with declared tools; Claude may invoke MCP tools.
4. MCP handlers call the relevant client (`GmailClient` / `CalendarClient` / `SheetsClient` / TrendPost storage / etc.).
5. Sensitive actions enqueue `ApprovalQueue` → `agent:waiting_approval` — except NixOps workflows at trust stage ≥3, which skip this gate.
6. User approves in UI, CLI, or Telegram (`/approve`) → action executes → `agent:task_complete`.

Email triage additionally emits `agent:triage_complete` with structured per-email categories and proposed actions; calendar review emits `agent:calendar_review_complete` with structured conflicts/overloaded-days/suggestions. Both are fully rendered (not just a summary) in the Command Center dashboard's Activity Feed via an expand/collapse toggle.

## Data locations

| Path                                   | Contents                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| `~/.wireassist/gmail-credentials.json` | Google OAuth client secret (user-provided)                        |
| `~/.wireassist/gmail-token.json`       | OAuth access + refresh token (Gmail, Calendar, Sheets)            |
| `~/.wireassist/wireassist.db`          | Approvals, memory, portfolio/focus, license tier (Command Center) |
| `~/.wireassist/ops-trust.json`         | Per-workflow NixOps trust stage                                   |
| `~/.wireassist/budget.json`            | Month-to-date spend tracking                                      |

Override base directory with `WIREASSIST_HOME` (in Docker: `/data`, via the named volume).

## TypeScript

Shared options live in `tsconfig.base.json`. Each package extends it with its own `tsconfig.json`.

Path aliases for AIA may map `@wireassist/core` to `wireassist/core/src` during development — check `wireassist/aia/tsconfig.json`.

pnpm 11's pinned version (`packageManager` in root `package.json`) uses `node:sqlite` internally, which requires **Node 22.13+** everywhere — not just Command Center.

## What is not in this repo

- `packages/core` and `packages/aia` — legacy paths from an earlier layout; packages live under `wireassist/`.
- `@aia/core` — renamed to `@wireassist/core`.
