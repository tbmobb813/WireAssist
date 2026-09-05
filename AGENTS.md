# Agent instructions for WireAssist

This file is for any AI coding agent (Claude Code, Cursor, etc.) working in this
repo. For what each package does, see `README.md`'s package table — this file
covers the things that aren't obvious from reading the code, and that cost real
time to rediscover the hard way.

## Architecture in one paragraph

Every chat message hits **Admin** first — Admin is the sole front door
(`packages/command-center/src/api/server.ts`'s `/api/tasks/freeform` route just
queues a plain Admin freeform task; there is no separate router/classifier
anymore, that was removed). Admin's own tool-calling loop
(`BaseAgent.runToolLoop`, `packages/agents/admin/src/base-agent.ts`) then
decides, per message: answer directly, hand off a specific well-defined action
to another agent via a `dispatch_*` tool (zero approval friction — see
`packages/agents/admin/src/chat-dispatch.ts`), or hand off something genuinely
open-ended via `delegate_to_agent` (requires human approval before the target
agent starts). **Don't confuse these two mechanisms** — they're deliberately
separate code paths with different approval semantics, not two names for the
same thing.

The six agents (`admin`, `content`, `research`, `strategy`/NixOps, `gtm`,
`github`) all inherit the same `BaseAgent`, and all follow the same
Observe → Think → Act loop: read accumulated context, one model call, dispatch
whatever tool calls came back, repeat until a final answer or `maxIterations`
(currently 12 across all six) is hit.

## Approval philosophy — gate outcomes, not steps

As of the most recent redesign: **approval should ask "should this real-world
thing happen," once — not repeatedly ask permission for intermediate work
toward it.**

- Content: generating/analyzing/remembering a draft is **not** gated. The real
  checkpoint is `schedule_post_skill` (deciding to actually schedule something
  live) — nothing publishes without first being scheduled, and
  `publish_due_posts_skill`'s cron sweep runs fully unattended by design once
  something's scheduled.
- Admin (email triage): each proposed action (draft a reply, label urgent,
  label ignore) is already a real, final effect — there's no draft phase to
  separate it from. The fix here wasn't removing approval, it was **batching**
  it: `proposeBatchOrAutoApprove` (`packages/agents/admin/src/skills/propose-or-auto-approve.ts`)
  bundles everything needing a real decision into ONE approval per triage run
  instead of one sequential prompt per action. The narrow auto-approve-for-
  trusted-senders carve-out still fires with zero prompt, same as before.
- If you're adding a new skill that proposes an action, ask: is this the
  actual outcome, or a step on the way to one? Gate the outcome.

## Context-flow contracts that don't show up in any type signature

Two mechanisms below break silently — no thrown error, no failing type check
— if you don't know the rule. Both were found by chasing real live bugs, not
by code review, which is exactly why they're worth writing down here instead
of relying on the next person to rediscover them the same way.

**Any event you want visible in the chat UI needs `payload.taskId` at the top
level, and an explicit listener in `server.ts`.** An agent emitting
`this.events.emit('agent:X', payload)` reaches the browser only if (a)
`server.ts` has `events.on('agent:X', (p) => broadcast('X', p))` — an
allowlist, nothing is visible by default — and (b) `payload` has a top-level
`taskId` field, since both the SSE push and the `/api/activity?taskId=`
polling fallback filter by it. Miss either one and the event fires, gets
broadcast, and is invisible end-to-end with no error anywhere. This bit
`agent:handoff_requested` twice: once when it shipped with `{ task }` and no
`taskId` at all (fixed 2026-08-28 for the `delegate_to_agent` path only), and
again when five more skill-initiated handoff sites (`detect-skill-
opportunities.ts`, `gtm/generate-strategy.ts` ×2, `research-topic.ts` ×2,
`market-gap-discovery.ts`) turned out to have the identical gap, caught only
by an explicit audit, not by the original fix generalizing on its own. Before
adding a new agent-visible event, grep `server.ts` for `events.on('agent:` to
confirm it's actually wired, and check every emit site for the field, not
just the first one you find.

**A skill's returned "answer" doubles as the tool-loop's stop signal — there
is no separate "am I actually done" check.** `BaseAgent.invokeSkill()`
doesn't use a skill's return value; it captures whatever payload the skill
_last_ emits and hands that back as the tool-call result. The outer
`runToolLoop` then does exactly one check to decide whether to stop:
`if (!response.toolCalls?.length) return response.content` — i.e., the model
stops the moment it doesn't feel like calling another tool. If a skill's
final payload reads as complete-sounding prose (a synthesized research
summary, a formatted report), the model will often treat the turn as
finished even when a concrete follow-up action was still the actual point —
this is exactly what happened when `research_topic_skill`'s synthesis made
the model skip a live `fetch_product_price` call it had already correctly
identified as necessary (fixed only by adding an explicit "LIVE PRICING"
instruction to `research-agent.ts`'s system prompt — a prompt-level patch on
one symptom, not a structural fix to the mechanism). If you hit this a second
time with a _different_ skill, that's the signal to stop patching prompts and
add a real signal (e.g. a `needsFollowUp` field on the skill's payload,
checked before the loop's early return) instead of a third bespoke paragraph.

## Build gotchas that will cost you real time if you don't know them

- **`packages/agents/*/dist/` is gitignored build output.** Any _other_
  package that imports `@wireassist/agent-admin` (etc.) runs against the
  compiled dist, not your edited TypeScript source. After editing anything in
  `packages/agents/admin/src`, run `pnpm --filter @wireassist/agent-admin
build` before trusting any other package's test run — otherwise you'll
  chase a "fix" that appears to do nothing, or a test failure that's actually
  just stale compiled output.
- **`turbo.json`'s `globalEnv` is an allowlist, not documentation.** An env
  var not listed there is silently stripped from task execution even if it's
  set in your shell or CI job env. If a task behaves differently under `turbo
run` than a bare shell command with the same env, check this file first.
- Full monorepo verification: `pnpm -r build && pnpm -r test` from the repo
  root. Prefer this over trusting a single package's test run when you've
  touched anything agent-admin depends on (which is most things, since it's
  the base class for every other agent).

## Deploy

Manual, not CI/CD: `git pull origin main && docker compose up -d --build
command-center`, run **on the VPS itself** (see `docs/DEPLOYMENT.md` for full
setup/troubleshooting — this repo is public, so infra specifics like the
actual host live outside of it). After deploying, confirm with `docker compose
ps` (should show `healthy` within ~30s) and check `git log --oneline -1` on
the VPS matches what you just pushed.

## Testing conventions already established in this repo

- New behavior gets a regression test in the same commit, not a follow-up.
  Look at recent commits for the house style: mock `SkillAgentHandle`/agent
  deps directly rather than hitting real Gmail/Calendar/Anthropic APIs.
- When fixing a bug found via live/manual testing, add the test _before_
  trusting the fix — several real bugs this session (JSON-parsing truncation,
  an `await`-vs-`return` bug in `executeChatDispatch`) were only caught
  because a test was written immediately and failed first.
- Comments in this codebase lean toward explaining _why_, especially for
  anything that looks like it could be simplified but can't (see almost any
  file in `packages/agents/admin/src` for the house style) — match that,
  don't strip comments down to describing _what_ the code does.
