# syntax=docker/dockerfile:1

# Builds the whole monorepo once; command-center and telegram-bot both run
# from this same image (see docker-compose.yml), selected via CMD override.
# api start script (`tsx src/api/server.ts`) runs from source, not dist, so
# devDependencies (tsx, concurrently) must stay installed at runtime — this
# image is not pruned to production-only deps.
FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

# better-sqlite3 needs a C++ toolchain to compile its native binding.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY wireassist/core/package.json wireassist/core/package.json
COPY packages/agents/admin/package.json packages/agents/admin/package.json
COPY packages/agents/content/package.json packages/agents/content/package.json
COPY packages/agents/research/package.json packages/agents/research/package.json
COPY packages/agents/ops/package.json packages/agents/ops/package.json
COPY packages/agents/gtm/package.json packages/agents/gtm/package.json
COPY packages/agents/github/package.json packages/agents/github/package.json
COPY packages/trendpost-mcp/package.json packages/trendpost-mcp/package.json
COPY packages/marketing/package.json packages/marketing/package.json
COPY packages/command-center/package.json packages/command-center/package.json
COPY packages/telegram-bot/package.json packages/telegram-bot/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# Builds every workspace package except the frozen Tauri desktop app, in
# dependency order (core/agents before command-center/telegram-bot).
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

WORKDIR /app
COPY --from=build /app /app

ENV NODE_ENV=production
ENV WIREASSIST_HOME=/data

VOLUME ["/data"]

EXPOSE 3001 3002
