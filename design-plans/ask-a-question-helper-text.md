# Add explanatory helper text to "Ask a Question" cards on Content, Research, and Ops

Written against: e076c1141ac39b197d9d01b6309945281e8e49ac

## Evidence chain

- Surface: `packages/command-center/src/app/content/page.tsx`, `packages/command-center/src/app/research/page.tsx`, `packages/command-center/src/app/ops/page.tsx`
- Problem: Each page's "ASK A QUESTION" freeform card renders only an input and a button — no explanatory line about what kind of question it's good for. Every other card on the same pages (and the equivalent card on `/gtm`) includes a one-line `<p>` helper before its input.
- Design evidence: `/research`'s "SYNTHESIZE EXISTING RESEARCH" card: `<p className="text-xs text-gray-600 mb-3">Pulls from prior research already stored in memory — won't search the web again.</p>` (`research/page.tsx:264-266`) and its "PAST RESEARCH" card: `<p className="text-xs text-gray-600 mb-3">Findings that have been approved and stored to memory — synthesize pulls from these.</p>` (`research/page.tsx:450-452`). `/gtm`'s own "Ask a Question" card already carries the pattern: `<p className="text-xs text-gray-600 mb-3">Quick GTM questions, or ask it to generate a strategy or psych tactics conversationally — the wizard is still the primary path for a full structured plan.</p>` (`gtm/page.tsx:961-963`) — proving this is an established, deliberate pattern elsewhere in the same codebase, not something universally omitted by design.
- Owner: no shared component — each page's helper `<p>` is written inline per-card; this plan adds one more inline `<p>` per page, following the exact existing style.
- Scope and affected surfaces: `content/page.tsx`, `research/page.tsx`, `ops/page.tsx`. `/gtm` and `/github` are excluded — `/gtm` already has this text; `/github`'s single input already opens with an explanatory line above it.
- Uncertainty: none — exact insertion points (immediately before each `<input>`) are already located.

## Design decision

Add one `<p className="text-xs text-gray-600 mb-3">...</p>` line directly above the freeform `<input>` on each of the three "ASK A QUESTION" cards, styled identically to the helper text already used elsewhere on the same pages, with wording specific to what that agent's freeform capability is actually good for (matching the specificity of `/gtm`'s existing line, not a generic placeholder).

## Reuse

- Style/markup pattern: `<p className="text-xs text-gray-600 mb-3">...</p>` — already used on `research/page.tsx:264-266`, `research/page.tsx:450-452`, and `gtm/page.tsx:961-963`
- Exemplar: `packages/command-center/src/app/gtm/page.tsx` lines 960-964 (title, helper text, then input) — copy this card's structure exactly

## Changes

1. `packages/command-center/src/app/content/page.tsx`
   - Change: In the "ASK A QUESTION" card (currently just a `<div className="text-xs tracking-widest text-gray-500 mb-3">ASK A QUESTION</div>` followed directly by the input), insert a helper `<p>` between the title div and the input, e.g. "General questions about your content strategy, past posts, or what to try next — not for generating a new post (use Single Post above for that)."
   - Preserve: The existing input, button, and response-rendering block below it — unchanged.
   - Verify: The card visually matches the "SINGLE POST" and "WEEKLY PLAN" cards' one-line-context-then-input structure.

2. `packages/command-center/src/app/research/page.tsx`
   - Change: In the "ASK A QUESTION" card, insert a helper `<p>` between the title div and the input, e.g. "Open-ended questions about research already done, or general research strategy — for a new web search, use Research a Topic above."
   - Preserve: The existing input, button, and response-rendering block below it — unchanged.
   - Verify: The card visually matches "SYNTHESIZE EXISTING RESEARCH" and "PAST RESEARCH"'s existing one-line-context-then-content structure.

3. `packages/command-center/src/app/ops/page.tsx`
   - Change: In the "ASK A QUESTION" card, insert a helper `<p>` between the title div and the input, e.g. "General questions about the business or its workflows — to actually run a named workflow, use Run Workflow above."
   - Preserve: The existing input, button, and response-rendering block below it — unchanged.
   - Verify: The card's structure now matches the pattern already established by its own page's other explanatory text (the trust-stage description block) and by `/gtm`'s equivalent card.

## Scope

- Inherit: First-time users on `/content`, `/research`, and `/ops` get the same up-front framing for the freeform card that `/gtm` users already get.
- Verify: No layout regression — each card's height grows by one line; confirm no card overflows or misaligns against its siblings in the existing grid/stack layout.
- Exclude: `/gtm` (already has this) and `/github` (already has an explanatory line above its single input) — no changes.

## Validation

- Product: Load each of the three pages and confirm the "ASK A QUESTION" card now reads title → helper line → input → button, matching its siblings' structure.
- Interface: Default viewport for all three pages; confirm no visual overflow or spacing regression in the card grid.
- System: Confirm the new helper text uses the exact same class string (`text-xs text-gray-600 mb-3`) as the existing exemplars, not a new ad hoc style.
- Repository: `pnpm --filter @wireassist/command-center typecheck && pnpm --filter @wireassist/command-center build` → both succeed with no new errors.

## Stop conditions

- Stop if a page's "ASK A QUESTION" card layout doesn't accommodate an extra line without visual crowding — flag for a layout adjustment rather than force-fitting the text.

## Design documentation

- After acceptance and validation: none — no design documentation exists for this app to update.
