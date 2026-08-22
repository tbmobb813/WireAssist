---
name: nixlevel-listing
trust_stage: 2
publish_target: none
inputs:
  product_concepts:
    type: string
    required: true
    periodic: false
    description: Product concept(s) and design description
  existing_example:
    type: string
    required: false
    periodic: false
    description: Existing best-performing listing example to mirror
  variant_naming:
    type: string
    required: false
    periodic: false
    description: Variant naming conventions
  printify_costs:
    type: string
    required: false
    periodic: true
    description: Current Printify cost sheet link or table
---

# Workflow: NixLevel product listing generation

**Use when:** you have one or more Etsy product concepts and need a full, upload-ready listing package (title, description, tags, variants, margin, marketing angles) for each.
**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — pilot workflow.
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: Every hour spent writing listings is an hour not spent on design or marketing. Listings follow a fixed template, so they're delegable.
OUTCOME: One or more product ideas go in; one complete, upload-ready Etsy listing package comes out per product.

## Definition of Done

For EACH product concept in the brief, a listing is DONE when all of these exist in `output/nixlevel/<product-slug>/` (one full set per product):

- [ ] `title.txt` — ≤140 chars, front-loaded keywords
- [ ] `description.md` — template-consistent: hook, product details, size/variant table, care instructions, shop CTA
- [ ] `tags.txt` — exactly 13 Etsy tags, ≤20 chars each, no special symbols/punctuation (`&`, `/`, `-`), no duplicates of title words wasted
- [ ] `variants.md` — variant naming matching existing NixLevel conventions
- [ ] `margin.md` — Printify base cost, print provider name (e.g. Monster Digital), target price, computed margin % (flag if <30%)
- [ ] `marketing.md` — 3 mockup/lifestyle photo angles + 2 marketing hooks
- [ ] **Multi-product batches only:** `batch-summary.md` in `output/nixlevel/` consolidating target prices, Printify costs, and computed margins across all products in the batch
- [ ] Self-assessed against this checklist, per product; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- Product concept + design description from JNix — for a batch, list each product concept as its own numbered or bulleted entry; each becomes its own listing package. Recommended batch size: roughly 2-5 products per run for full-detail output — much larger batches should be split into multiple runs.
- Existing listing example to mirror: _SETTING: JNix pastes one best-performing listing here_
- Variant naming convention: _SETTING: JNix pastes current convention here_
- Printify base costs: _SETTING_PERIODIC: link or paste current cost sheet_

## DATA loop specifics

- **Diagnose:** Check inputs above are filled; if a SETTING is empty, escalate before generating. Also confirm every product concept in the brief is distinct and specific enough to generate a full listing from — flag (don't guess) any that's too vague.
- **Assemble:** Plan the 6 artifacts for EACH product; number the plan by product so nothing gets merged or dropped. Reuse `tools/` templates if present.
- **Take Action:** Generate all 6 artifacts for every product, clearly delimited by a `## Product N: <name>` heading — never merge two products' artifacts together.
- **Assess:** Verify every Definition-of-Done box independently for EACH product; check tag lengths and title chars programmatically, not by eye.

## Escalation rules

- Margin below 30% on any product → flag that product, don't pick the price yourself.
- Trademark-risky phrases in any product's title/tags → flag.
- Nothing is uploaded to Etsy at this stage — JNix uploads after review.
