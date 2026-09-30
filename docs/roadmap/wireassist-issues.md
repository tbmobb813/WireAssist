=== ISSUE ===
title: [Tier 0] Add authentication to the Command Center API and stop binding 0.0.0.0
labels: security,tier-0
body:
## Problem
`packages/command-center/src/api/server.ts` serves on `hostname: '0.0.0.0'` and only applies `cors({ origin: 'http://localhost:3001' })`. CORS is not authentication. I found no auth middleware. Anyone who can reach port 3002 can call `/api/approvals/:id/approve`, which bypasses the human-in-the-loop gate that is WireAssist's main safety feature. This must be fixed before using the app from a phone.

## Acceptance criteria
- [ ] Bearer-token middleware on all `/api/*` routes; `/health` stays open.
- [ ] Token comes from an env var (e.g. `WIREASSIST_API_TOKEN`); the server refuses to start without one when not bound to loopback.
- [ ] Default bind is `127.0.0.1`, configurable via env.
- [ ] Next.js proxy, Telegram bot and all `dev/*.sh` cron scripts send the token.
- [ ] Tests: 401 without token, 200 with token, `/health` open.
- [ ] `docs/DEPLOYMENT.md` and `docs/SETUP.md` updated.

## Notes
Confirm the docker-compose port mapping does not publish 3002.

=== ISSUE ===
title: [Tier 0] Wire up conversation encryption or remove the privacy claim
labels: security,tier-0
body:
## Problem
`ConversationEncryption` (`wireassist/core/src/privacy/encryption.ts`) is exported but nothing in storage calls it. `encryptConversations` defaults to `false` in `privacy/controller.ts` and is never read. The README describes WireAssist as privacy-oriented, which the code does not yet back up.

## Acceptance criteria
- [ ] Decision recorded in this issue: implement or drop the claim.
- [ ] If implementing: encrypt message content at rest in `storage/messages.ts` and `storage/conversations.ts` behind a setting, with the key from an env var or keyfile, plus a migration path for existing rows and tests.
- [ ] If dropping: README and docs wording changed to what the code actually does.
- [ ] Either way, no dead code left that implies a feature that does not exist.

=== ISSUE ===
title: [Tier 1] Approvals screen: handle failed requests, show readable email/calendar payloads, bigger tap targets
labels: bug,ux,mobile,tier-1
body:
## Problems (all in `packages/command-center/src/app/approvals/approvals-client.tsx`)
1. `resolve()` never checks `res.ok` and removes the card after any response. On a network error the button stays stuck on "..." and on an HTTP error the card disappears as if approved.
2. `PayloadPreview` only recognizes `content`, `summary`, `synthesis`, `sources`, `analysis`, delegation and batch `actions`. Verify what the admin agent puts in `gmail_send` and calendar payloads; if they fall through, the real content is only visible under the collapsed "RAW PAYLOAD".
3. Approve/Reject are `py-2 text-xs` (~32px), side by side, for irreversible actions like sending email.
4. Cards lead with an agent badge and the raw action string instead of a plain-language summary. Timestamp shows time only, not date or age, and the queue auto-rejects after 10 minutes.

## Acceptance criteria
- [ ] Failed approve/reject keeps the card and shows an error; button state always resets.
- [ ] Email payloads render To / Subject / Body; calendar payloads render title / time / attendees.
- [ ] Buttons at least 48px tall with spacing between them; consider a confirm step for send actions.
- [ ] One-line plain summary first, details second; show age and time remaining.
- [ ] Component tests for the failure path.

=== ISSUE ===
title: [Tier 1] Mobile-first home: approvals inbox as landing page, bottom tab bar, PWA manifest
labels: ux,mobile,enhancement,tier-1
body:
## Goal
Make the phone experience usable: see what needs your OK and act in seconds.

## Current state
`shell.tsx` already has a mobile drawer, but nav is a top-left hamburger over 9 destinations grouped by department, pages use `p-8` (18 places), there is no PWA manifest or service worker, and no web push. `dashboard-client.tsx` already has a "Needs Attention" section.

## Acceptance criteria
- [ ] Landing page on mobile = "Needs Attention" + approvals, with the bento grid collapsed below.
- [ ] Bottom tab bar with four tabs: Home, Approvals (count badge), Chat, More; department grouping removed from mobile nav.
- [ ] Page padding `p-4 md:p-8`; fixed hamburger no longer overlaps headers.
- [ ] PWA manifest + icons so it installs to the home screen.
- [ ] Plain-language copy replaces "WIREASSIST // APPROVALS" style headings; `text-gray-600` text raised to meet 4.5:1 contrast.
- [ ] Optional follow-up: web push for new approvals (Telegram stays as fallback).

## Depends on
The approvals fixes issue.

=== ISSUE ===
title: [Tier 1] Real MCP connector layer, starting with Slack
labels: enhancement,integrations,tier-1
body:
## Problem
`wireassist/core/src/mcp/client.ts` is a local tool registry, not real MCP. Only `packages/agents/github` speaks real MCP (against GitHub's hosted server). Every other integration (Gmail, Calendar, Sheets, Drive, WordPress, YouTube) is a hand-written client, and there is no Slack support. Competitors advertise hundreds to thousands of integrations.

## Acceptance criteria
- [ ] Generic MCP client in core: servers declared in a config file (command/URL + env), tool discovery at startup, namespaced tool names.
- [ ] Every mutating tool is approval-gated by default through the existing approval queue; read-only tools are not.
- [ ] Slack connected as the first server: read channels/messages; post a message only via approval.
- [ ] GitHub agent migrated onto the shared client (or confirmed to share its code).
- [ ] Tests with a fake MCP server; docs on adding a server.
- [ ] Existing Google clients left alone in this issue.

=== ISSUE ===
title: [Tier 1] Scoreboard: metrics table, scheduled pulls and weekly wins/opportunities digest
labels: enhancement,analytics,tier-1
body:
## Problem
The objectives store (`wireassist/core/src/objectives/store.ts`) tracks agent activity toward goals, not results. There is no metrics storage and no growth stats view.

## Acceptance criteria
- [ ] `metrics` table in core storage: date, source, metric, value, optional tags.
- [ ] Scheduled pulls from two or three sources already connected (e.g. YouTube, WordPress/site analytics, TrendPost post counts).
- [ ] `/api/metrics` endpoint and a dashboard tile with trends.
- [ ] Define "win": objective completed or metric crossing a configured threshold; store wins.
- [ ] Weekly digest task (what moved, wins, one suggested action) delivered via Telegram and shown on the dashboard.
- [ ] Digest says "insufficient data" instead of guessing when sources are missing.

## Enables
Post metrics, outcome loop and playbooks issues.

=== ISSUE ===
title: [Tier 1] Pull real post performance and make content retro use it
labels: enhancement,content,tier-1
body:
## Problem
`packages/agents/content/src/skills/content-retro.ts` asks "what's actually working" but feeds the model post text plus `content_analyze`'s estimated engagement. `scheduled_posts` (`packages/trendpost-mcp/src/storage.ts`) has no metrics columns and no code fetches platform stats. The retro is model opinion, not analysis.

## Acceptance criteria
- [ ] `post_metrics` table: post_id, captured_at, window (24h / 7d), impressions, likes, shares, comments, clicks where available.
- [ ] Fetcher for at least one platform already published to; scheduled capture at 24h and 7d after `published_at`.
- [ ] `content_retro` prompt receives real numbers and states "no real data yet" for posts without metrics.
- [ ] Metrics flow into the scoreboard issue's table.
- [ ] Tests for capture timing and the no-data path.
- [ ] Also verify `publish_due_posts` cannot double-publish if two sweeps overlap (mark the post before sending).

=== ISSUE ===
title: [Tier 1] Shared business profile + onboarding interview
labels: enhancement,onboarding,tier-1
body:
## Problem
Each agent has its own `context/IDENTITY.md`, `SOUL.md` and `USER.md`, with duplicated business context. New setup requires manual file editing, OAuth, Node 22, pnpm and VPS cron.

## Acceptance criteria
- [ ] One shared business profile (goals, offers, audience, voice, constraints, current priorities) in a single location loaded by every agent via a shared loader in core.
- [ ] Onboarding interview in chat (build on the existing `/onboarding` route) that fills the profile and can be re-run to update it.
- [ ] Per-agent context files keep only agent-specific behavior and link to the shared profile.
- [ ] Profile changes are visible in the dashboard and editable by hand.
- [ ] Setup doc trimmed to the minimum steps for a first run.

=== ISSUE ===
title: [Tier 2] Automations screen: one place to see and control every scheduled job
labels: enhancement,ux,tier-2
body:
## Problem
There are 18 scripts in `dev/`, each a cron-driven curl to the API. Nothing in the app shows what is scheduled, when it last ran, what its trust stage is, or whether the cron line is actually installed.

## Acceptance criteria
- [ ] Registry of jobs (name, endpoint, cadence, trust stage, purpose).
- [ ] `/automations` screen: on/off toggle, last run and result, next run, trust stage, run-now button.
- [ ] Health check flags jobs that should have run but did not.
- [ ] Phase 2 (optional): move scheduling into the app so cron is one entry or none.
- [ ] Trust-stage changes still require the existing explicit action.

=== ISSUE ===
title: [Tier 2] Outcome loop: link approved actions to real results
labels: enhancement,learning,tier-2
body:
## Problem
Current learning is about your preferences (approve/reject history, auto-approve after 3 approvals, weekly proactive insights). Nothing records whether an approved action actually produced a result, so the system cannot learn what grows the business.

## Acceptance criteria
- [ ] Each approval can carry an optional expected-outcome definition (metric + window).
- [ ] After the window, a job reads the scoreboard/post metrics and records the result against the approval and its objective.
- [ ] Proactive insights and weekly digest include outcome-backed findings (what worked, what did not) and cite the data.
- [ ] Trust-graduation nudges can reference outcomes, not just approval counts.
- [ ] Clear "no data" behavior.

## Depends on
Scoreboard and post-metrics issues.

=== ISSUE ===
title: [Tier 2] Growth playbooks as workflow files scored against your own metrics
labels: enhancement,content,tier-2
body:
## Goal
Give the agents curated business-intelligence frameworks to apply, grounded in your own data rather than generic advice.

## Acceptance criteria
- [ ] Playbook format (markdown, same convention as `packages/agents/ops/context/workflows/`): when to use, inputs, metrics consulted, decision rules, output.
- [ ] Three starter playbooks chosen by you (e.g. weekly content review, channel/niche opportunity check, outreach follow-up cadence).
- [ ] Agents select a playbook from the business profile and current metrics, and cite which one they used.
- [ ] Recommendations must reference specific metrics; when data is missing they say so.
- [ ] Output lands in the weekly digest as "opportunities".

## Depends on
Shared business profile and scoreboard issues.
