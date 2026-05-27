# Contributing to SynqWorks (Nolta)

## Development philosophy

- **Clarity over cleverness** — readable code beats terse tricks
- **Type safety** — avoid `any` unless justified
- **Modular design** — single responsibility per module
- **Tests with behavior** — cover real logic, not trivial assertions
- **Comments for why** — not what the code already says

## Getting started

1. [SETUP.md](./SETUP.md) — install, env vars, Google OAuth
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — packages and agent flow
3. Explore entry points:
   - `synqworks/core/src/index.ts` — core exports
   - `packages/agents/admin/src/admin-agent.ts` — Admin Agent
   - `packages/command-center/src/api/server.ts` — API bootstrap

## Code structure

### `@synqworks/core` (`synqworks/core/`)

```
src/
├── client.ts              # AIClient orchestrator
├── types.ts
├── providers/             # OpenAI, Anthropic, Gemini, Ollama
├── storage/               # SQLite conversations, FTS search
├── context/               # File/git/workspace context
├── privacy/               # Audit, encryption, local-first
├── streaming/
├── agents/                # Agent types & registry
├── mcp/                   # MCPClient tool dispatch
├── approval/              # ApprovalQueue
├── memory/                # MemoryStore
├── events/                # EventBus
└── __tests__/
```

### `linux-ai-assistant` (`synqworks/lai/`)

```
src/                 # React UI (Vite)
src-tauri/           # Tauri Rust backend
cli/                 # Optional CLI (Rust)
playwright-e2e/      # E2E tests
```

### `@synqworks/agent-admin` (`packages/agents/admin/`)

```
src/
├── admin-agent.ts     # Task execution (triage, calendar, freeform)
├── base-agent.ts      # Claude completions
├── gmail-client.ts    # OAuth + Gmail API
├── calendar-client.ts # Calendar API (shared token)
├── mcp-setup.ts       # Register MCP tool handlers
├── task-factory.ts    # AgentTask builders
└── demo.ts            # CLI demo with [y/n] approvals
```

### `@synqworks/command-center` (`packages/command-center/`)

```
src/
├── api/server.ts      # Hono API + agent bootstrap
└── app/               # Next.js pages (dashboard, approvals, chat, memory)
```

## Common tasks

### Add an AI provider (core)

1. Implement `Provider` in `synqworks/core/src/providers/newprovider.ts`
2. Register in `synqworks/core/src/providers/index.ts`
3. Add tests under `synqworks/core/src/__tests__/providers/`
4. `pnpm build:core && pnpm test:core`

### Add an MCP tool (Admin Agent)

1. Add a method on `GmailClient` or `CalendarClient` if needed
2. Register in `packages/agents/admin/src/mcp-setup.ts`:

   ```typescript
   mcp.register('my_tool', async (params) => {
     return gmail.someMethod(params.id as string);
   });
   ```

3. Declare the tool name in `AdminAgent` config (`admin-agent.ts` `tools` array)
4. Rebuild: `pnpm --filter @synqworks/agent-admin build`

### Add a new agent task type

1. Extend `SupportedTaskInput` in `task-factory.ts`
2. Add a factory function (e.g. `createMyTask`)
3. Handle the type in `admin-agent.ts` `run()` switch
4. Expose via Command Center API in `packages/command-center/src/api/server.ts` if needed

### UI component (LAI desktop)

1. Add component under `synqworks/lai/src/components/`
2. `pnpm dev:lai` for HMR

### UI page (Command Center)

1. Add route under `packages/command-center/src/app/`
2. `pnpm dev:command-center`

## Credentials and local data

Never commit:

- `.env`, `.env.local`
- `~/.synqworks/gmail-credentials.json`
- `~/.synqworks/gmail-token.json`
- `~/.synqworks/synqworks.db`

Use `SYNQWORKS_HOME` in development if you need an isolated config directory.

## Testing

```bash
pnpm test              # all packages with test scripts
pnpm test:core
pnpm --filter linux-ai-assistant test
```

## Pull requests

- Keep PRs focused on one concern
- Update `README.md` or `docs/` when changing layout, env vars, or public APIs
- Run `pnpm build` for packages you touched
- Note manual test steps (OAuth, Command Center, etc.)

## Legacy paths

Older docs may reference `packages/core`, `packages/lai`, or `@lai/core`. Current locations:

| Legacy | Current |
|--------|---------|
| `packages/core` | `synqworks/core` (`@synqworks/core`) |
| `packages/lai` | `synqworks/lai` (`linux-ai-assistant`) |
| `@lai/core` | `@synqworks/core` |
