# Prive - A Linux Based AI Assistant

A monorepo containing the core AI engine and desktop/web applications for a privacy-first, multi-provider AI assistant.

## 📁 Structure

```
lai/
├── packages/
│   ├── core/     # @lai/core - Core AI engine (providers, storage, context)
│   └── lai/      # linux-ai-assistant - Native Linux Tauri desktop app
└── docs/         # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm 9.0.0+
- Rust (for Tauri desktop app)

### Installation
```bash
cd /home/nixstation-remote/Projects/lai
pnpm install
```

### Development

**Start all packages in dev mode:**
```bash
pnpm dev
```

**Start specific package:**
```bash
pnpm dev:core    # Just core AI engine
pnpm dev:lai     # Just LAI desktop app
```

### Building

**Build all packages:**
```bash
pnpm build
```

**Build specific package:**
```bash
pnpm build:core
pnpm build:lai
```

### Testing

**Run all tests:**
```bash
pnpm test
```

**Run tests for specific package:**
```bash
pnpm test:core
pnpm test:lai
```

## 📦 Packages

### @lai/core
Multi-provider AI engine with local-first privacy support.

**Features:**
- Support for OpenAI, Anthropic, Google Gemini, and Ollama
- Full-text search on conversations (SQLite + FTS5)
- Context building from files, git, and workspace
- Privacy controls and audit logging
- Streaming response support

**Location:** `packages/core/`

### linux-ai-assistant
Native Linux desktop application built with Tauri + React.

**Features:**
- System tray integration
- Global keyboard shortcuts
- Multi-provider AI switching
- Conversation management
- File watcher

**Location:** `packages/lai/`

## 🔧 Architecture

The monorepo uses **pnpm workspaces** for package management:
- **Local linking:** Packages automatically link to each other
- **Shared dev tools:** ESLint, Prettier, TypeScript config at root
- **Independent builds:** Each package can be built/tested separately
- **Workspace commands:** `pnpm -r` runs commands across all packages

## 📚 Documentation

See the `/docs` folder for:
- `ARCHITECTURE.md` - Deep dive into the monorepo design
- `SETUP.md` - Detailed setup and configuration
- `CONTRIBUTING.md` - Development guidelines

## 🎯 Current Phase

**Phase 1: MVP Integration**
- [x] Set up monorepo structure
- [x] Link @lai/core to LAI app
- [ ] Test @lai/core integration in LAI
- [ ] Basic conversation management UI
- [ ] Multi-provider switching

## 📝 License

MIT
