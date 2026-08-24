# Workflow: NixLevel product listing generation

**Use when:** you have one or more Etsy product concepts and need a full, upload-ready listing package (title, description, tags, variants, margin, marketing angles) for each.
**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — pilot workflow.
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: Every hour spent writing listings is an hour not spent on design or marketing. Listings follow a fixed template, so they're delegable.
OUTCOME: One or more product ideas go in; one complete, upload-ready Etsy listing package comes out per product.

## Definition of Done

For EACH product concept in the brief, a listing is DONE when all of these exist in `output/nixlevel/<product-slug>/` (one full set per product):

- [ ] `title.txt` — ≤140 chars, structured as `[Primary keyword] | [Secondary keyword + modifier] | [Occasion/recipient]`, front-loaded with the term a real buyer would type first
- [ ] `description.md` — template-consistent: **first 160 characters carry the primary keyword and the single most important detail** (this is Etsy's confirmed secondary ranking signal — most mobile buyers read no further), then hook, product details, size/variant table, care instructions, shop CTA
- [ ] `tags.txt` — exactly 13 Etsy tags, ≤20 chars each, no duplicates of title words wasted, at least 4-5 built from buyer-intent terms ("personalized," "custom," "ready to ship," a specific occasion) rather than plain product-noun restatements
- [ ] `variants.md` — variant naming matching existing NixLevel conventions
- [ ] `marketing.md` — 3 mockup/lifestyle photo angles + 2 marketing hooks
- [ ] `margin.md` — **produced for every product, using the pricing basis that matches its fulfillment type** (see Inputs and Escalation rules): digital-download products price off Etsy's own seller fees, physical/POD products price off Printify base cost + Etsy fees. Only skipped if the fulfillment type itself can't be determined from the brief.
- [ ] Self-assessed against this checklist, per product; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- Product concept + design description from JNix, **including whether it's a digital download or a physical/print-on-demand item** — for a batch, list each product concept as its own numbered or bulleted entry; each becomes its own listing package. Recommended batch size: roughly 2-5 products per run for full-detail output — much larger batches should be split into multiple runs.
- Existing listing example to mirror: _SETTING: JNix pastes one best-performing listing here_
- Variant naming convention: _SETTING: JNix pastes current convention here_
- Printify base costs: _SETTING_PERIODIC: link or paste current cost sheet — physical/POD products only, not used for digital downloads_
- Etsy fee reference (US seller, as of this workflow's last update — re-verify periodically, Etsy changes these): $0.20 listing fee per item, 6.5% transaction fee on the total sale price including shipping charged, 3% + $0.25 payment processing. Offsite Ads is a further 12-15% but only ever applies to a sale Etsy's own offsite ads actually drove — never assume it applies by default.
- **Real keyword/competitor grounding (recommended, not required to proceed):** NixOps has no web-search tool of its own, so title/tag keywords are otherwise the model's best guess, not verified search data. For grounded terms, start the run from the **Research agent** instead of typing the brief directly here — ask it to look up real competing Etsy listings and search-volume signals for the product concept; Research hands off to this workflow automatically with those findings attached, and Diagnose below treats that handoff data as real grounding rather than a guess.

## DATA loop specifics

- **Diagnose:** Check inputs above are filled. A missing `_SETTING:_`/`_SETTING_PERIODIC:_` never blocks the whole run by itself — it only removes the one artifact that specifically depends on it (a missing "existing listing example" or "variant naming convention" is a quality gap to flag in the run report, not a hard stop, since the other artifacts don't strictly need them). First determine each product's fulfillment type from the brief — digital download or physical/POD — since this decides which pricing basis `margin.md` uses; if the brief doesn't say and it isn't obvious from the concept, escalate rather than assume one. For a physical/POD product with no Printify cost on file, `margin.md` for that product is skipped (same as before). Note whether this run arrived via a Research handoff (real keyword/competitor data attached) or a raw brief (no external grounding) — a raw brief means title/tag keywords must be flagged as reasoned estimates, not presented as verified search data, per the escalation rule below. Also confirm every product concept in the brief is distinct and specific enough to generate a full listing from — flag (don't guess) any that's too vague.
- **Assemble:** Plan the artifacts that apply for EACH product (5 always, `margin.md` per its fulfillment-type basis, or skipped only if a physical product has no Printify cost on file); number the plan by product so nothing gets merged or dropped. Reuse `tools/` templates if present.
- **Take Action:** Generate every applicable artifact for every product, clearly delimited by a `## Product N: <name>` heading — never merge two products' artifacts together.
- **Assess:** Verify every Definition-of-Done box independently for EACH product; check tag lengths and title chars programmatically, not by eye.

## Escalation rules

- Digital-download product: `margin.md` prices off Etsy's own fees only (listing fee + 6.5% transaction fee + payment processing, per the Etsy fee reference above) — never off Printify, which doesn't apply to a product with no physical fulfillment.
- Physical/POD product with no Printify base cost on file → skip `margin.md` for that product, don't guess a cost or invent a margin figure; say plainly in the run report that pricing is the one remaining manual step.
- Margin below 30% on any product (when `margin.md` was produced) → flag that product, don't pick the price yourself.
- A product whose fulfillment type (digital vs. physical/POD) isn't stated or obvious from the brief → escalate and ask, don't default to either — the wrong pricing basis silently understates or overstates real margin.
- Title/tag keywords produced without Research-handoff grounding → mark them as reasoned estimates in the run report, not verified search data — same principle as `article-package.md`'s keyword-research escalation rule.
- Trademark-risky phrases in any product's title/tags → flag.
- Nothing is uploaded to Etsy at this stage — JNix uploads after review.
