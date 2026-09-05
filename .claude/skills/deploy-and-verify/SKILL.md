---
name: deploy-and-verify
description: Ship a WireAssist code change end-to-end - build, test, commit, push, deploy to the VPS, and live-verify against production. Use whenever a WireAssist fix or feature is ready to ship, or when asked to deploy/ship/release changes.
---

Ship a WireAssist change the way every real fix has shipped this session —
full verification at every step, never trusting a step because the
previous one passed.

## Steps

1. **Full monorepo build.** `pnpm build` from the repo root (or
   `pnpm --filter <package> build` first if iterating on one package, but
   always confirm with a full `pnpm build` before shipping — `dist/` for
   each `packages/agents/*` package is gitignored, and a downstream
   package silently runs against stale dist otherwise).
2. **Full monorepo test.** `pnpm test` from the repo root. Confirm every
   package's suite is green — don't stop at the package you touched,
   since `agent-admin` is the base class for every other agent and a
   change there can break things you didn't expect.
3. **Stage only the intended files.** `git add <specific files>` — never
   `git add -A`. Check `git status`/`git diff --cached --stat` before
   committing.
4. **Commit with a real "why."** Explain the root cause and the fix, not
   just what changed. If the fix came from a live bug (not just a code
   review finding), say what the live symptom was.
5. **Confirm before pushing.** Committing and pushing are separate asks —
   don't push without the user explicitly saying so, even right after a
   commit.
6. **Deploy on the VPS itself**, not from here: `git pull origin main &&
docker compose up -d --build command-center`, run over SSH on the VPS.
7. **Verify health.** `docker compose ps` should show `(healthy)` within
   about 30 seconds. Also confirm `git log --oneline -1` on the VPS
   matches the commit just pushed.
8. **Live-verify against the real running system, not just the tests.**
   Hit the actual API/behavior the fix touches (a real chat message via
   `/api/tasks/freeform`, a real `GET`/`DELETE` against the endpoint that
   changed, etc.) and read the real response — passing unit tests have
   missed real bugs multiple times this session (token truncation,
   missing event fields, routing misclassification, a fetch that was
   only ever narrated in prose and never actually called).
9. **Clean up any test data the live-verification created** — reject a
   test approval, delete a test memory row by exact id (see the
   `safe-db-edit` skill for anything requiring a direct DB edit) — don't
   leave debris in the live system.
10. **Update the project's memory file** (`~/.claude/projects/.../memory/project_wireassist.md`)
    with what shipped, why, and what was actually verified — not just
    "fixed X," but the live evidence that it's fixed.

## Don't

- Don't skip the full monorepo test run because "only one package
  changed" — cross-package breakage from `agent-admin` changes is a real,
  repeated failure mode.
- Don't declare a fix "done" off a passing test suite alone if there's a
  way to hit the real system instead.
- Don't push or deploy without being asked, even if a commit was just
  approved — each step gets its own go-ahead.
