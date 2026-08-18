# Move ObjectivePicker to page-level scope on Content, Research, Ops, and GTM

Written against: e076c1141ac39b197d9d01b6309945281e8e49ac

## Evidence chain

- Surface: `packages/command-center/src/app/content/page.tsx`, `packages/command-center/src/app/research/page.tsx`, `packages/command-center/src/app/ops/page.tsx`, `packages/command-center/src/app/gtm/page.tsx`
- Problem: `ObjectivePicker` is rendered inside only one of several sibling task-creation cards on each page, but the single `objectiveId` state value it controls is sent with every sibling card's own request. The picker's visual placement implies it scopes one action; the actual code silently applies the same selection (or silently omits tagging, on `/content`) to every action on the page.
- Design evidence: `/chat` (`packages/command-center/src/app/chat/chat-client.tsx`) already establishes the correct pattern in this same codebase — one `ObjectivePicker` placed at the page/header level, scoping the entire page's output, not nested inside one card among several. `objective-picker.tsx`'s own file comment states it's meant to be used "identically" across task-creation forms.
- Owner: `packages/command-center/src/app/objective-picker.tsx` (`ObjectivePicker` + `useActiveObjectives` — unchanged, reused as-is)
- Scope and affected surfaces: `content/page.tsx`, `research/page.tsx`, `ops/page.tsx`, `gtm/page.tsx`. `/github` and `/chat` are excluded — `/github` has only one task-creation action (no sibling-card ambiguity to resolve), `/chat` already does this correctly.
- Uncertainty: none — the exact card boundaries and existing `objectiveId` state/fetch wiring on each page are already read and confirmed in this plan.

## Design decision

On each of the four pages, move the existing `<ObjectivePicker objectives={activeObjectives} value={objectiveId} onChange={setObjectiveId} />` out of whichever single card currently contains it, and render it once at page level in a position visually shared by every sibling task-creation card — directly under the page's title/description block, before the first card. This makes the picker's scope ("this objective tag applies to whatever you create below") visually match what the code already does (or should do — see Changes below for `/content`, where two actions don't currently send `objectiveId` at all and must be wired up to match the others).

## Reuse

- `ObjectivePicker`, `useActiveObjectives` — `packages/command-center/src/app/objective-picker.tsx` (no changes to this file)
- Exemplar: `packages/command-center/src/app/chat/chat-client.tsx` — page-header-level picker placement, same component, same `objectiveId` state pattern

## Changes

1. `packages/command-center/src/app/content/page.tsx`
   - Change: Remove the `<ObjectivePicker .../>` currently rendered inside the "SINGLE POST" card (around the existing `objectiveId`/`activeObjectives` usage). Render one `<ObjectivePicker objectives={activeObjectives} value={objectiveId} onChange={setObjectiveId} />` at page level, directly below the header `<p>` description and above the `grid grid-cols-3` layout. Additionally thread `objectiveId: objectiveId || undefined` into `generatePlan()`'s and `runFreeform()`'s POST bodies — currently neither sends it at all, so today those two actions can never be tagged to an objective regardless of picker placement. Server-side support is already in place and confirmed: `/api/tasks/generate-plan` reads `body.objectiveId` and passes it as `ContentTasks.generatePlan`'s 5th argument (`server.ts:828-834`), and `/api/tasks/content-freeform` reads `objectiveId` and passes it to `ContentTasks.freeform` (`server.ts:856-862`) — this is a client-only gap.
   - Preserve: All existing card layout, the three cards' own distinct fields (topic/tone/context, business context/platforms/cadence, freeform prompt), and existing behavior when no objective is selected (`objectiveId` stays `''`, sent as `undefined`).
   - Verify: Generating a single post, a weekly plan, and a freeform answer while an objective is selected all produce tasks tagged with that `objectiveId` (visible on `/objectives/[id]`'s Kanban board); with no objective selected, all three still work exactly as before.

2. `packages/command-center/src/app/research/page.tsx`
   - Change: Remove the `<ObjectivePicker .../>` currently rendered inside the "RESEARCH A TOPIC" card. Render one instance at page level, directly below the header `<p>` description and above the "RESEARCH A TOPIC" card. No fetch-body changes needed — `runResearch()`, `runSynthesize()`, and `runFreeform()` already all send `objectiveId: objectiveId || undefined`.
   - Preserve: All three cards' existing fields and layout; the `draftContent`/`draftPlatform` sub-controls stay inside "RESEARCH A TOPIC".
   - Verify: Running a topic search, a synthesis, and a freeform question while an objective is selected all tag their resulting task with that `objectiveId`.

3. `packages/command-center/src/app/ops/page.tsx`
   - Change: Remove the `<ObjectivePicker .../>` currently rendered inside the "RUN WORKFLOW" card (immediately above the `brief` textarea). Render one instance at page level, directly below the header `<p>` description and above the "RUN WORKFLOW" card. No fetch-body changes needed — `runWorkflow()` and `runFreeform()` already both send `objectiveId`.
   - Preserve: The workflow-selection dropdown, trust-stage control, and todo-fill inputs stay inside "RUN WORKFLOW" exactly as they are today.
   - Verify: Running a workflow and asking a freeform question while an objective is selected both tag their resulting task with that `objectiveId`.

4. `packages/command-center/src/app/gtm/page.tsx`
   - Change: Remove the `<ObjectivePicker .../>` currently rendered inside Step 2 ("Business Model & Goals") of the wizard. Render one instance at page level, directly below the header block and above the step wizard / "Ask a Question" card (i.e. visible regardless of which wizard step is active, and shared with the separate "Ask a Question" card). No fetch-body changes needed for the freeform path — `runFreeform()` already sends `objectiveId`; confirm the wizard's own generate-strategy/generate-psych submission (Step 3/4) still reads `objectiveId` from the same state variable it already uses today.
   - Preserve: The 5-step wizard flow, its own per-step fields, and the "Pre-filled from README" notice.
   - Verify: Generating a GTM strategy via the wizard and asking a freeform question both tag their resulting task with the same selected `objectiveId`; switching wizard steps does not reset or hide the objective selection.

## Scope

- Inherit: Every task type created from these four pages (single post, content plan, content freeform, research topic/synthesize/freeform, ops workflow/freeform, GTM strategy/psych/freeform) gains consistent, visible objective tagging.
- Verify: `/objectives/[id]`'s Kanban board (`packages/command-center/src/app/objectives/[id]/page.tsx`) still renders cards correctly for tasks originating from all four pages after the picker moves — no change expected there, but worth a spot check since this plan changes which actions can now carry an `objectiveId` for the first time (`/content`'s plan and freeform actions).
- Exclude: `/github` (single action, no ambiguity) and `/chat` (already correct) — no changes.

## Validation

- Product: On each of the four pages, select an objective, trigger every sibling action on that page in turn, and confirm each resulting task appears on that objective's Kanban board (`/objectives/[id]`). Then repeat with no objective selected and confirm normal (untagged) behavior is unchanged.
- Interface: All four pages at their default viewport; `/gtm` specifically across all 5 wizard steps, confirming the picker stays visible/consistent as steps change.
- System: Confirm no page still has a second, redundant `ObjectivePicker` instance left behind inside a card, and that `/chat`'s existing header-level pattern was followed exactly (same component, same page-level positioning relative to the header).
- Repository: `pnpm --filter @wireassist/command-center typecheck && pnpm --filter @wireassist/command-center build` → both succeed with no new errors.

## Stop conditions

- Stop if the GTM wizard's Step 3/4 strategy-generation submission turns out to read `objectiveId` from a source other than the shared page-level state this plan relies on (would need tracing before moving the picker).

## Design documentation

- After acceptance and validation: none — no design documentation exists for this app to update.
