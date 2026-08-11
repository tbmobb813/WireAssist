# Workflow: Courier weekend route + earnings log

**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — every route weekend produces the same shape of data.
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: Turning raw route notes and receipts into clean spreadsheet rows after a long weekend of driving is exactly the kind of clerical work that eats founder time for zero strategic upside.
OUTCOME: Raw route notes/receipts from the weekend go in; clean, ready-to-append sheet rows plus a weekly summary come out.

## Definition of Done

A weekend's routes are DONE when all of these exist in `output/courier/<week-slug>/`:

- [ ] `routes.md` — one row per route, formatted as a markdown table matching the Routes sheet's columns: date, start/end time, stops, miles, gross earned, fuel cost, net
- [ ] `summary.md` — weekly totals: total stops, total miles, total net, $/mile, $/hour
- [ ] `anomalies.md` — any route that's an outlier (unusually low/high pay for the stop count, missing earnings data, a route with no logged time) — empty file with "None this week" if there are none, not skipped
- [ ] `pricing-quote.md` — only produced if a new client or route type appeared this week; otherwise this artifact is skipped and the run report says why
- [ ] Self-assessed against this checklist; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- Raw route notes/receipts from JNix (photos, text, or verbal recap) for the weekend being logged
- Routes sheet reference: _TODO: JNix pastes the spreadsheet and tab so Diagnose can pull current state and avoid duplicate rows — see the NixLevel listing workflow for how a Sheet input is wired up_
- Standard per-mile / per-stop rate card: _TODO: JNix pastes current rates_
- Fuel cost basis (e.g. $/gallon, mpg estimate): _TODO: JNix confirms current fuel assumptions_

## DATA loop specifics

- **Diagnose:** Pull the Routes sheet's current state if wired up, to see the last logged date and avoid re-entering rows that are already there. Check the inputs above are filled; if the rate card or fuel basis is missing, escalate before computing net figures rather than guessing them.
- **Assemble:** Plan which routes from the notes are new vs. already logged.
- **Take Action:** Produce `routes.md` and `summary.md`; only produce `pricing-quote.md` if a new client/route type genuinely appeared.
- **Assess:** Verify the arithmetic in `summary.md` sums correctly against the individual route rows in `routes.md`. Verify no route in `routes.md` duplicates a date/time already present in the sheet's current state.

## Escalation rules

- A route with missing or ambiguous earnings data → flag it in `anomalies.md`, don't estimate a number to fill the gap.
- Net $/mile drops meaningfully below the standard rate card → flag, don't set new pricing.
- Any client dispute, non-payment, or complaint mentioned in the notes → stop and escalate immediately, per SOUL.md's hard guardrail on disputes.
- Nothing is sent to a client or posted anywhere at this stage — this workflow only produces sheet rows and drafts for JNix to review.
