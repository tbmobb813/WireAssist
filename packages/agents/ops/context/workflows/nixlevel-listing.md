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

## Inputs (Camcorder Method — captured from live shop 2026-07-17)

- Product concept + design description from JNix

### Listing example to mirror (live: etsy.com/listing/4307913417)

**Title (137 chars):**
`Legacy in Progress Hoodie - Motivational Black Owned Streetwear | Empowerment Apparel with NIXLEVEL Branding | Unisex Fit`

**Description structure (mirror this exactly):**

1. One-line emotional hook: "Progress isn't just a goal — it's a legacy in motion."
2. One short paragraph tying the design to the buyer's journey/hustle, naming the product and NIXLEVEL.
3. "Product Highlights:" bullet list — design placement, sleeve/label branding ("Vertical NIXLEVEL sleeve branding"), fit + comfort ("Unisex fit, fleece-lined"), colors, size range.
4. Closing identity line: "Whether you're starting your story or continuing the legacy, wear it with pride."
5. "Note:" line for surcharges: "Sizes 2XL and up include a small material surcharge."

**Tags (all 13, verbatim):**
`unisex hoodie, cozy sweatshirt, legacy in progress, motivational apparel, casual wear, gift for him, gift for her, inspiration clothing, everyday hoodie, perfect for fall, comfortable outfit, trendy sweatshirts, stylish hoodies`

- Pattern: mix of product-type long-tail (hoodie/sweatshirt synonyms), the design name itself, niche terms (motivational apparel, inspiration clothing), gift terms, and seasonal/lifestyle terms.

### Variant naming convention (from live listings)

- Variant option 1 = **Sizes**: `S, M, L, XL, 2XL, 3XL, 4XL, 5XL` (numeric XL style, never "XXL").
- Variant option 2 = **Colors**: Printify color names verbatim, title case (`Dark Heather, Maroon, Black, Military Green`).
- Pricing: one flat price S–XL; single higher tier for 2XL+ (e.g. $44.99 / $47.99). Round retail to .99 or .87.
- Surcharge always disclosed in description as a "Note:" line.

### Printify base costs (catalog, Monster Digital — your Etsy print provider — 2026-07-17)

**Hoodie — Gildan 18500 Heavy Blend (matches Legacy hoodie):**
| Size | Base cost | w/ Printify Premium |
|------|-----------|---------------------|
| S–XL | $23.11 | $17.00 |
| 2XL | $25.32 | $18.62 |
| 3XL | $26.58 | $19.55 |
| 4XL–5XL | $27.11 | $19.94 |
Shipping (US, first item): from $7.69. Avg production 1.4 days.

**Tee — Bella+Canvas 3001 (assumed blueprint for Gold Signature Tee — ⚠️ unconfirmed, product is an unmigrated "external product" in Printify):**
| Size | Base cost | w/ Printify Premium |
|------|-----------|---------------------|
| S–XL | $11.54 | $9.22 |
| 2XL | $14.10 | $11.27 |
| 3XL | $16.44 | $13.13 |
Shipping (US, first item): from $3.99.

⚠️ Margin check on current listings: tee at $22.87 retail − $11.54 base − $3.99 ship (if free-shipping is offered) ≈ 32% before Etsy fees (~9.5%) → **below the 30% floor after fees; flag on any new tee priced under ~$26**. Hoodie at $44.99 with free shipping: $44.99 − $23.11 − $7.69 ≈ 31% before fees → also tight; escalate per rules.

## DATA loop specifics

- **Diagnose:** Check inputs above are filled; if a TODO is empty, escalate before generating.
- **Assemble:** Plan the 6 artifacts; reuse `tools/` templates if present.
- **Take Action:** Generate artifacts into the output folder.
- **Assess:** Verify every Definition-of-Done box; check tag lengths and title chars programmatically, not by eye.

## Escalation rules

- Margin below 30% → flag, don't pick the price yourself.
- Trademark-risky phrases in title/tags → flag.
- Nothing is uploaded to Etsy at this stage — JNix uploads after review.
