# Workflow: Courier route/records logging

**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: Manually transcribing each weekend's stops, tips, and mileage into a spreadsheet is pure tabulation — it eats time that should go into the courier work itself, not bookkeeping.
OUTCOME: Raw run notes (stops, times, tips, mileage, issues) go in; a clean set of appended rows in the courier log sheet plus a short run summary come out.

## Definition of Done

A run is DONE when all of these exist:

- [ ] Every stop from the raw input appears as one row matching the log sheet's exact column order (date, stop #, area/zone, delivery time, tip, mileage, notes)
- [ ] No full street addresses in the sheet if the existing sheet convention doesn't use them — city/zone only, checked against current sheet content, not assumed
- [ ] `run-summary.md` — total stops, total tips, total mileage, any flagged issues (missed delivery, damaged package, client complaint)
- [ ] Mileage total cross-checked against any provided odometer/GPS figure; discrepancy >5% flagged, not silently reconciled
- [ ] Self-assessed against this checklist; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- Courier log spreadsheet: _TODO: JNix pastes the Sheet ID here, then adds a `**Sheet:** <spreadsheetId> | <tab>!<range>` line directly under Trust stage above — that's what turns this on for the Diagnose stage._
- Column layout of the existing sheet: _TODO: JNix pastes the header row (or describes it) if it isn't obvious from a live read_
- Raw run notes for the day/weekend: stops, times, tips, mileage, issues — pasted per run

## DATA loop specifics

- **Diagnose:** Read the current sheet state (via the `**Sheet:**` reference, once set) so new rows don't duplicate or skip ones already logged. Check the raw notes cover every stop with at least an area/zone and a time; flag anything the sheet's columns have no place for.
- **Assemble:** Map each stop to the sheet's exact column order before generating anything.
- **Take Action:** Produce `new-rows.md` — a paste-ready table of the new rows — plus `run-summary.md`. This workflow only _reads_ the sheet in the DATA loop; it does not write to it (no `sheets_append` call is wired in yet) — the new rows are always a draft for JNix to paste in, even past trust stage 2.
- **Assess:** Row count matches stop count; mileage and tip totals cross-footed against the raw notes by hand in the report, not just claimed.

## Escalation rules

- Any client complaint or damaged-package note → flag it plainly in the run summary, don't soften it.
- Mileage discrepancy >5% vs. any provided GPS/odometer figure → flag, don't guess which number is right.
- If the `**Sheet:**` reference isn't set yet or the read fails, say so and fall back to producing `new-rows.md` from the raw notes alone — don't block the whole run on it.
