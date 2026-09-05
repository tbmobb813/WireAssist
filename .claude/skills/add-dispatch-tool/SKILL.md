---
name: add-dispatch-tool
description: Add a new dispatch_* tool so Admin can hand off a specific, well-defined action to another agent with zero approval friction. Use for well-defined actions (not open-ended asks, which use the existing delegate_to_agent instead).
---

`dispatch_*` tools (zero-approval, well-defined actions) and
`delegate_to_agent` (always approval-gated, open-ended) are deliberately
separate mechanisms — see `AGENTS.md`'s architecture section. Never touch
`delegate_to_agent` while adding a dispatch tool; other things depend on
its exact behavior unchanged.

A dispatch tool touches **five** places. Missing any one of them produces
a tool the model can see but that silently does nothing, or a task that
runs but that Admin's own type-checking doesn't know about — always wire
all five in the same change.

## Steps

1. **`ChatDispatch` interface**
   (`packages/agents/admin/src/chat-dispatch.ts`) — add the method
   signature (e.g. `researchTopic(input, ctx): Promise<ChatDispatchResult>`).
2. **`DISPATCH_TOOL_NAMES`** (same file) — add the new tool's name
   (`'dispatch_<name>'`) to the `Set`. This is what
   `admin-agent.ts`'s `executeToolCall` checks to route into the dispatch
   path at all — miss this and the tool call falls through to the normal
   (approval-gated) handling instead.
3. **Tool schema** in `buildChatDispatchToolSchemas()` (same file) — name,
   a description the model will actually use to decide when to call this
   versus `delegate_to_agent` or another dispatch tool (be explicit about
   scope — e.g. `dispatch_research_topic`'s description names what does
   and doesn't count as "a single research X ask"), and the input schema.
4. **Route it in `admin-agent.ts`'s `executeChatDispatch`** — add a case
   calling `this.chatDispatch.<method>(...)`.
5. **Implement it in `server.ts`'s `buildChatDispatch()`** — the concrete
   version that actually builds and queues the task, e.g.
   `const task = ResearchTasks.researchTopic(...); queueResearchTask(task); return { ... };`.
   This is where `task.input.type` gets set — remember that whichever
   `input.type` you choose determines whether `BaseAgent.run()` routes
   straight to a Skill (bypassing that agent's own freeform tool loop and
   system prompt entirely) or goes through `freeform` — see
   `add-agent-skill`'s note on this for why that distinction matters for
   anything the skill needs a live tool loop to finish.
6. **Full monorepo build + test**, live-verify the actual dispatch against
   the running system (see `live-debug-chat-task`) before deploying (see
   `deploy-and-verify`).

## Don't

- Don't add a dispatch tool for anything genuinely open-ended — that's
  what `delegate_to_agent` is for, and it needs the human approval gate.
- Don't touch `delegate_to_agent`'s own code path while doing this.
- Don't assume the target skill's system prompt/tool-loop-level
  instructions will apply — if `task.input.type` routes straight to a
  Skill via `SkillExecutor`, no system prompt gets read at all for that
  invocation (this was the root cause of a real live-pricing regression).
