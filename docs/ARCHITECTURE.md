# Architecture

## Overview

**Nolta** is a pnpm monorepo for **SynqWorks**: a local-first AI stack with a shared core library, a desktop chat client, and an agent layer that performs real-world tasks (email, calendar) behind an approval gate.

```mermaid
flowchart TB
  subgraph clients [Clients]
    CC[Command Center UI<br/>Next.js :3001]
    LAI[linux-ai-assistant<br/>Tauri + React]
    CLI[Admin demo CLI]
  end

  subgraph agents [Agents]
    AA[AdminAgent<br/>packages/agents/admin]
  end

  subgraph core [@synqworks/core]
    MCP[MCPClient]
    AQ[ApprovalQueue]
    MS[MemoryStore]
    EB[EventBus]
    AI[AIClient / Providers]
  end

  subgraph external [External APIs]
    G[Gmail API]
    C[Google Calendar API]
    CL[Anthropic Claude]
  end

  CC -->|REST + SSE| API[Hono API :3002]
  API --> AA
  CLI --> AA
  LAI --> AI
  AA --> MCP
  AA --> AQ
  AA --> MS
  AA --> EB
  AA --> CL
  MCP --> G
  MCP --> C
```

## Packages

### `@synqworks/core` (`synqworks/core/`)

Foundation library used by LAI and SynqWorks agents.

**Original LAI responsibilities:**

- Multi-provider AI (`AIClient`, OpenAI, Anthropic, Gemini, Ollama)
- SQLite storage with FTS search
- Context building (files, git, workspace)
- Privacy controls and streaming

**SynqWorks agent platform additions:**

| Module | Role |
|--------|------|
| `agents/` | Agent types and registry |
| `mcp/` | `MCPClient` — register and dispatch tool handlers |
| `approval/` | `ApprovalQueue` — persist pending human approvals |
| `memory/` | `MemoryStore` — agent memory in SQLite |
| `events/` | `EventBus` — task lifecycle events for UI/SSE |

Entry point: `synqworks/core/src/index.ts`.

### `linux-ai-assistant` (`synqworks/lai/`)

Native Linux desktop app (Tauri + React + Vite).

- Consumes `@synqworks/core` for chat and providers
- System tray, shortcuts, CLI tooling
- Independent from Command Center / Admin Agent

### `@synqworks/agent-admin` (`packages/agents/admin/`)

Claude-powered agent for administrative work.

| File | Role |
|------|------|
| `admin-agent.ts` | Task handlers: email triage, calendar review, freeform |
| `base-agent.ts` | Anthropic completion helper |
| `gmail-client.ts` | OAuth + Gmail API |
| `calendar-client.ts` | Reuses Gmail OAuth token for Calendar API |
| `mcp-setup.ts` | Registers `gmail_*` and `calendar_*` MCP tools |
| `task-factory.ts` | Builds typed `AgentTask` objects |

**Auth paths** (both clients):

```ts
const HOME_PATH = process.env.SYNQWORKS_HOME ?? os.homedir();
// $HOME_PATH/.synqworks/gmail-credentials.json
// $HOME_PATH/.synqworks/gmail-token.json
```

### `@synqworks/command-center` (`packages/command-center/`)

Operational UI for running agents.

| Layer | Tech | Port |
|-------|------|------|
| Web | Next.js 15 | 3001 |
| API | Hono + `@hono/node-server` | 3002 |

**API highlights:**

- `POST /api/tasks/triage-email` — queue inbox triage
- `POST /api/tasks/review-calendar` — queue calendar review
- `POST /api/tasks/freeform` — ad-hoc instruction
- `GET/POST /api/approvals/*` — approval queue
- `GET /api/events` — SSE stream of agent events

Bootstrap wires `setupAdminMCP` → `AdminAgent` with SQLite at `~/.synqworks/synqworks.db`.

## Monorepo layout

```
Nolta/
├── synqworks/
│   ├── core/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── providers/
│   │   │   ├── storage/
│   │   │   ├── agents/ memory/ approval/ mcp/ events/
│   │   │   └── ...
│   │   └── package.json          # @synqworks/core
│   └── lai/
│       ├── src/                  # React UI
│       ├── src-tauri/            # Rust backend
│       └── package.json          # linux-ai-assistant
├── packages/
│   ├── agents/admin/
│   └── command-center/
├── docs/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Workspace configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'synqworks/core'
  - 'synqworks/lai'
  - 'packages/agents/admin'
  - 'packages/command-center'
```

Internal dependencies use `workspace:*`:

```json
"@synqworks/core": "workspace:*"
```

`better-sqlite3` is listed under `onlyBuiltDependencies` because it compiles native bindings.

## Agent task flow

1. Client queues a task (`AgentTask` from task factory).
2. `AdminAgent.run()` emits `agent:task_started` on `EventBus`.
3. Agent calls Claude with declared tools; Claude may invoke MCP tools.
4. MCP handlers call `GmailClient` / `CalendarClient`.
5. Sensitive actions enqueue `ApprovalQueue` → `agent:waiting_approval`.
6. User approves in UI or CLI → action executes → `agent:task_complete`.

Email triage additionally emits `agent:triage_complete` with structured categories and proposed actions.

## Data locations

| Path | Contents |
|------|----------|
| `~/.synqworks/gmail-credentials.json` | Google OAuth client secret (user-provided) |
| `~/.synqworks/gmail-token.json` | OAuth access + refresh token |
| `~/.synqworks/synqworks.db` | Approvals + memory (Command Center) |

Override base directory with `SYNQWORKS_HOME`.

## TypeScript

Shared options live in `tsconfig.base.json`. Each package extends it with its own `tsconfig.json`.

Path aliases for LAI may map `@synqworks/core` to `synqworks/core/src` during development — check `synqworks/lai/tsconfig.json`.

## What is not in this repo

- `packages/core` and `packages/lai` — legacy paths from an earlier layout; packages live under `synqworks/`.
- `@lai/core` — renamed to `@synqworks/core`.
