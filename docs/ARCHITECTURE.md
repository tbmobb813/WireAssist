# Architecture

## Overview

**WireAssist** is a TechTrendWire product: a local-first AI stack with a shared core library, a Command Center, and an agent layer that performs real-world tasks (email, calendar) behind an approval gate. The desktop app under `wireassist/aia/` is frozen.

```mermaid
flowchart TB
  subgraph clients [Clients]
    CC[Command Center UI<br/>Next.js :3001]
    AIA[ai-assist<br/>Tauri + React]
    CLI[Admin demo CLI]
  end

  subgraph agents [Agents]
    AA[AdminAgent<br/>packages/agents/admin]
  end

  subgraph core [@wireassist/core]
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
  AIA --> AI
  AA --> MCP
  AA --> AQ
  AA --> MS
  AA --> EB
  AA --> CL
  MCP --> G
  MCP --> C
```

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

**Auth paths** (both clients):

```ts
const HOME_PATH = process.env.WIREASSIST_HOME ?? os.homedir();
// $HOME_PATH/.wireassist/gmail-credentials.json
// $HOME_PATH/.wireassist/gmail-token.json
```

### `@wireassist/command-center` (`packages/command-center/`)

Operational UI for running agents.

| Layer | Tech                       | Port |
| ----- | -------------------------- | ---- |
| Web   | Next.js 16                 | 3001 |
| API   | Hono + `@hono/node-server` | 3002 |

**API highlights:**

- `POST /api/tasks/triage-email` — queue inbox triage
- `POST /api/tasks/review-calendar` — queue calendar review
- `POST /api/tasks/freeform` — ad-hoc instruction
- `GET/POST /api/approvals/*` — approval queue
- `GET /api/events` — SSE stream of agent events

Bootstrap wires `setupAdminMCP` → `AdminAgent` with SQLite at `~/.wireassist/wireassist.db`.

## Monorepo layout

```
WireAssist/
├── wireassist/
│   ├── core/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── providers/
│   │   │   ├── storage/
│   │   │   ├── agents/ memory/ approval/ mcp/ events/
│   │   │   └── ...
│   │   └── package.json          # @wireassist/core
│   └── aia/
│       ├── src/                  # React UI
│       ├── src-tauri/            # Rust backend
│       └── package.json          # ai-assist
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
  - 'wireassist/core'
  - 'wireassist/aia'
  - 'packages/agents/admin'
  - 'packages/command-center'
```

Internal dependencies use `workspace:*`:

```json
"@wireassist/core": "workspace:*"
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

| Path                                   | Contents                                   |
| -------------------------------------- | ------------------------------------------ |
| `~/.wireassist/gmail-credentials.json` | Google OAuth client secret (user-provided) |
| `~/.wireassist/gmail-token.json`       | OAuth access + refresh token               |
| `~/.wireassist/wireassist.db`          | Approvals + memory (Command Center)        |

Override base directory with `WIREASSIST_HOME`.

## TypeScript

Shared options live in `tsconfig.base.json`. Each package extends it with its own `tsconfig.json`.

Path aliases for AIA may map `@wireassist/core` to `wireassist/core/src` during development — check `wireassist/aia/tsconfig.json`.

## What is not in this repo

- `packages/core` and `packages/aia` — legacy paths from an earlier layout; packages live under `wireassist/`.
- `@aia/core` — renamed to `@wireassist/core`.
