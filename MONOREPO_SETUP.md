# AIA Monorepo Setup

> **Historical document.** The repo layout has moved to `synqworks/core`, `synqworks/aia`, and `packages/agents/*`. See [README.md](./README.md) and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the current structure.

This monorepo is the **primary source of truth** for AIA development.

## Repository Structure

```
aia/ (monorepo root)
├── packages/
│   ├── core/          # @aia/core - AI engine with multi-provider support
│   │   ├── src/
│   │   │   ├── client.ts          # AIClient orchestrator
│   │   │   ├── providers/         # OpenAI, Anthropic, Gemini, Ollama
│   │   │   ├── storage/           # ConversationStore, MessageStore
│   │   │   ├── context/           # ContextBuilder for file/workspace
│   │   │   ├── privacy/           # Encryption, audit logging
│   │   │   └── streaming/         # Stream parsing and buffering
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── aia/           # ai-assist - Desktop UI (Tauri + React)
│       ├── src/
│       │   ├── components/        # React components
│       │   ├── lib/
│       │   │   ├── api/           # Database adapters for @aia/core
│       │   │   ├── stores/        # Zustand stores (chatStore, settingsStore)
│       │   │   ├── providers/     # Provider integration
│       │   │   └── utils/         # Tauri IPC, error handling
│       │   └── __tests__/         # Integration tests
│       ├── cli/                   # Rust/Tauri backend (future)
│       ├── package.json
│       └── tsconfig.json
│
├── docs/              # Architecture, setup, and guides
├── README.md          # Project overview
├── pnpm-workspace.yaml
└── package.json       # Root workspace configuration

```

## Key Integration Points

### 1. @aia/core Package
- **Source:** `packages/core/src`
- **Built to:** `packages/core/dist`
- **Export:** Main entry point exports all public APIs
- **Usage:** Imported as `@aia/core` via workspace symlink

### 2. AIA App Database Adapters
- **Location:** `packages/aia/src/lib/api/`
  - `core-adapter.ts` - Maps @aia/core to AIA API format
  - `database-core.ts` - Core-backed database implementation
  - `database-hybrid.ts` - Switches between Tauri and Core

### 3. Shared Configuration
- **TypeScript:** `tsconfig.base.json` at root
- **ESLint:** `.eslintrc.js` at root
- **Prettier:** `.prettierrc.json` at root

## Development Workflow

### Install Dependencies
```bash
pnpm install
```

### Run Tests
```bash
# All packages
pnpm test

# Specific package
pnpm test:core
pnpm test:aia
```

### Build
```bash
# All packages
pnpm build

# Specific package
pnpm build:core
pnpm build:aia
```

### Development Mode
```bash
# Run all packages in watch mode
pnpm dev

# Or specific package
pnpm dev:core
pnpm dev:aia
```

## External Repositories

These are maintained separately but should reference this monorepo:

### `/aia-core` (deprecated)
- Original standalone @aia/core repository
- Now superseded by `packages/core/` in monorepo
- **Action:** Keep as backup/archive, don't commit new changes here

### `ai-assist - l.a.i.` (deprecated)
- Original AIA app repository
- Now superseded by `packages/aia/` in monorepo
- **Action:** Keep as backup/archive, don't commit new changes here

## Phase 1: MVP Integration Status

✅ **Completed:**
- [x] Monorepo structure with pnpm workspaces
- [x] @aia/core linked via workspace symlink
- [x] Core integration tests (23 tests)
- [x] Database adapters for ConversationStore & MessageStore
- [x] Hybrid database switching (Tauri ↔ Core)
- [x] Multi-provider integration (OpenAI, Anthropic, Gemini, Ollama)
- [x] Type safety and full TypeScript support

🔄 **In Progress:**
- [ ] End-to-end message flow (user → provider → storage)
- [ ] Streaming response integration
- [ ] Search integration with @aia/core SearchEngine

## Adding New Features

1. **To @aia/core:** Update in `packages/core/src/`
2. **To AIA app:** Update in `packages/aia/src/`
3. **Test locally:** Run `pnpm test` to verify integration
4. **Build:** Run `pnpm build` before committing

## Git Workflow

```bash
# Start feature
git checkout -b feature/name

# Develop in monorepo
pnpm test  # Verify everything works

# Commit (both packages together)
git add .
git commit -m "feat: description"

# Push to GitHub
git push origin feature/name

# Create PR against main
```

## Notes

- All development happens in `/aia` monorepo
- @aia/core in `packages/core/` is the source of truth
- AIA app in `packages/aia/` imports @aia/core via workspace
- External repos (`/aia-core`, `ai-assist`) are deprecated for MVP
- Can be cleaned up or archived after Phase 1 completion
