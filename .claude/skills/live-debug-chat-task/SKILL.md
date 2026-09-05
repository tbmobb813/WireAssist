---
name: live-debug-chat-task
description: Debug a WireAssist chat/agent task against the live production API instead of trusting unit tests or a task's own "complete" status. Use whenever a reported bug is behavioral (wrong routing, a tool that should have fired but didn't, an event that never showed up) rather than a straightforward code defect.
---

The two real regressions found this session (a missing `payload.taskId`
on several `handoff_requested` emits, and `research_topic_skill` narrating
a tool call instead of making it) were both invisible to the existing test
suite and only surfaced by hitting the real running system and reading the
actual response content — not by trusting a task's own `status: "complete"`
field, which was true in both cases despite the underlying bug.

## Steps

1. **Submit the real request** that reproduces the reported behavior via
   `POST /api/tasks/freeform` (or whatever endpoint the reported bug came
   through):
   ```bash
   ssh <ssh-flags> jason@<vps-host> \
     "curl -s -X POST http://localhost:3001/api/tasks/freeform \
       -H 'Content-Type: application/json' \
       -d '{\"instruction\":\"<the exact prompt that triggers the behavior>\"}'"
   ```
2. **Poll the task record**, not just its status — read the actual
   `output` field:
   ```bash
   ssh <ssh-flags> jason@<vps-host> "curl -s http://localhost:3001/api/tasks/<taskId>"
   ```
   `"status":"complete"` does NOT mean the task did the right thing — both
   real bugs this session completed "successfully" while doing the wrong
   thing.
3. **Check the tool-call trace**, not just the final answer:
   ```bash
   ssh <ssh-flags> jason@<vps-host> "curl -s 'http://localhost:3001/api/activity?taskId=<taskId>'"
   ```
   Look for which tools actually fired (`tool_call_started` events) versus
   what the final text claims happened — a model narrating "fetching
   now..." without a matching tool-call event in this trace is the exact
   shape of the live-pricing bug.
4. **Check pending approvals** if the task proposed an action:
   ```bash
   ssh <ssh-flags> jason@<vps-host> "curl -s http://localhost:3001/api/approvals"
   ```
   Read the full `payload` — a "Store research findings" approval whose
   `summary` field describes an unfinished analysis is itself evidence of
   a bug, not something to approve reflexively.
5. **Read the actual code path the task took**, not the path you assume
   it took. Both bugs this session were mis-diagnosed at first glance
   (assumed a model-judgment problem) until tracing `task.input.type`
   through `BaseAgent.run()`'s `SkillExecutor` routing revealed which
   code actually ran.
6. **Clean up whatever the test created** — reject a test approval via
   `POST /api/approvals/<id>/reject`, delete a test memory row via
   `DELETE /api/memory/<id>` — don't leave debris in the live system (see
   `safe-db-edit` for anything that needs a direct DB script instead).

## Don't

- Don't conclude "it's fixed" from a task reaching `status: complete` —
  read what it actually did.
- Don't assume a reported bug is model-judgment (the model "chose wrong")
  before tracing which code path actually ran — both real bugs this
  session turned out to be structural (a routing/dispatch mechanism
  bypassing the code the fix lived in), not the model failing to follow
  an instruction.
- Don't leave test approvals/memory rows in the live system after
  debugging.
