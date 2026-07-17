# Workflow: NixLevel product listing generation

**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — pilot workflow.
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: Every hour spent writing listings is an hour not spent on design or marketing. Listings follow a fixed template, so they're delegable.
OUTCOME: A new product idea goes in; a complete, upload-ready Etsy listing package comes out.

## Definition of Done

A listing is DONE when all of these exist in `output/nixlevel/<product-slug>/`:

- [ ] `title.txt` — ≤140 chars, front-loaded keywords
- [ ] `description.md` — template-consistent: hook, product details, size/variant table, care instructions, shop CTA
- [ ] `tags.txt` — exactly 13 Etsy tags, ≤20 chars each, no duplicates of title words wasted
- [ ] `variants.md` — variant naming matching existing NixLevel conventions
- [ ] `margin.md` — Printify base cost, target price, computed margin % (flag if <30%)
- [ ] `marketing.md` — 3 mockup/lifestyle photo angles + 2 marketing hooks
- [ ] Self-assessed against this checklist; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- Product concept + design description from JNix
- Existing listing example to mirror: _TODO: JNix pastes one best-performing listing here_
- Variant naming convention: _TODO: JNix pastes current convention here_
- Printify base costs: _TODO: link or paste current cost sheet_

## DATA loop specifics

- **Diagnose:** Check inputs above are filled; if a TODO is empty, escalate before generating.
- **Assemble:** Plan the 6 artifacts; reuse `tools/` templates if present.
- **Take Action:** Generate artifacts into the output folder.
- **Assess:** Verify every Definition-of-Done box; check tag lengths and title chars programmatically, not by eye.

## Escalation rules

- Margin below 30% → flag, don't pick the price yourself.
- Trademark-risky phrases in title/tags → flag.
- Nothing is uploaded to Etsy at this stage — JNix uploads after review.
