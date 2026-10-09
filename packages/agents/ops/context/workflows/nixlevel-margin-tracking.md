# Workflow: NixLevel margin tracking

**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: Margin drifts silently as Printify base costs change — catching it a month late, after a run of underpriced sales, costs real money. Computing margin per listing is arithmetic, not judgment.
OUTCOME: Current Printify costs + current Etsy prices go in; an updated margin picture plus a flagged list of anything under the 30% floor come out.

## Definition of Done

A tracking run is DONE when all of these exist:

- [ ] Every active listing accounted for with: SKU/title, Printify base cost, Etsy price, Etsy fees (transaction + payment processing — use current published Etsy rates, don't hardcode a stale %), computed margin %
- [ ] `margin-flags.md` — every listing under 30% margin, named explicitly, with the computed shortfall
- [ ] Row/listing count reconciled against the prior tracked period ± any new or removed listings — nothing silently dropped
- [ ] Self-assessed against this checklist; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- Margin tracking spreadsheet: _TODO: JNix pastes the Sheet ID here, then adds a `**Sheet:** <spreadsheetId> | <tab>!<range>` line directly under Trust stage above to activate live reads._
- Current Printify base cost export or paste
- Current Etsy listing prices (export or paste)

## DATA loop specifics

- **Diagnose:** Read the current margin sheet (once the `**Sheet:**` reference is set) to see what's already tracked, so unchanged rows aren't recomputed from scratch. Flag if the cost or price input covers fewer listings than the sheet already has — that's a missing-input case, not something to paper over.
- **Assemble:** Match cost-input rows to price-input rows by SKU/title before computing anything.
- **Take Action:** Compute margin % per listing per the Definition of Done formula; write `margin-flags.md` for everything under 30%.
- **Assess:** Spot-check the arithmetic on the single lowest-margin listing by hand in the report — don't just assert the numbers are right.

## Escalation rules

- Never change a listed price. Flag it and recommend a number; JNix decides.
- Margin below 30% → flag, don't pick a new price yourself.
- A listing with no matching cost or price input → escalate as blocked; don't estimate its margin.
