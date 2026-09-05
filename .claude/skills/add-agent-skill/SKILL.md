---
name: add-agent-skill
description: Add a new Skill to a WireAssist agent (a multi-step capability like research_topic or email_triage). Use when a new agent capability needs orchestration across multiple tool calls, think()/proposeAction()/remember() calls, not a single raw external action.
---

A **Skill** (`skills/*.ts`) bundles a fixed multi-step sequence — tool
calls plus `think()`/`proposeAction()`/`remember()`/`emit()` — around one
agent capability. If the new thing is a single raw external I/O action
with no orchestration, it's a **tool** instead (see `mcp-setup.ts` in the
agent's package) — don't build a Skill that just wraps one tool call with
no real logic around it.

## Steps

1. **Confirm it's actually a Skill, not a Tool.** Ask: does this need
   search → judge → fetch → reason, or multiple approval/memory
   interactions? If it's one external action with structured in/out and
   no orchestration, it's a tool.
2. **Write the skill file** in `packages/agents/<agent>/src/skills/<name>.ts`:
   - Export an `input` interface.
   - Export a `Skill<Input, Output>` object: `name`, `role`,
     `description`, optionally `requiresApproval`, and an `async execute({ agent, task, input })`.
   - Inside `execute`, the skill only sees a narrow `SkillAgentHandle` —
     `think`, `useTool`, `loadContext`, `remember`, `proposeAction`,
     `emit`, plus read-only listing methods. It cannot call another
     skill or chain (deliberate — recursion risk).
   - **Every event a skill emits that should be chat-visible needs a
     top-level `taskId` field** (see the context-flow section of this
     repo's `AGENTS.md`) — this has been missed multiple times and is
     silently invisible if forgotten.
   - The skill's _last_ `agent.emit()` call is what gets captured and
     returned to the outer tool loop if this skill is invoked as a
     tool-call from `freeform` — see `invokeSkill()` in `base-agent.ts`.
     If the skill's final answer might look "finished" to a model but
     actually needs a deterministic follow-up action (see the live-
     pricing fix in `research-topic.ts` for a real example), do that
     follow-up _inside_ the skill rather than relying on the outer loop
     to notice — the outer loop doesn't always run for this skill (see
     `add-dispatch-tool`'s note on `SkillExecutor` routing).
3. **Register it** in `packages/agents/<agent>/src/skills/index.ts`: add
   to the agent's `_SKILLS` array (e.g. `RESEARCH_SKILLS`).
4. **Wire tool schemas** if this skill should also be callable as a tool
   from the freeform loop — add to the agent's `_SKILL_TOOLS` schema list
   (check `tool-schemas.ts` for the pattern) so the model can see and
   invoke it.
5. **Write tests** matching house style
   (`skills/__tests__/<name>.test.ts`): mock `SkillAgentHandle` directly
   (`think`, `useTool`, `loadContext`, `remember`, `proposeAction`,
   `emit` as `jest.fn()`s) rather than hitting real APIs. Cover: the
   happy path, each approval branch (granted/declined), and any
   conditional/handoff logic.
6. **Rebuild the package** (`pnpm --filter @wireassist/agent-<name> build`)
   before trusting any downstream package's test run — `dist/` is
   gitignored, stale dist silently breaks nothing visibly.
7. **Full monorepo build + test** before committing (see
   `deploy-and-verify`).

## Don't

- Don't let a skill call another skill or chain directly — that's
  deliberately blocked (recursion risk); compose via a `SkillChain`
  instead if genuinely needed.
- Don't emit a chat-visible event without a top-level `taskId`.
- Don't assume the outer freeform tool loop will "clean up" an unfinished-
  looking result from this skill — if `input.type` routing can reach this
  skill directly (via a dispatch tool), there is no outer loop for that
  path.
