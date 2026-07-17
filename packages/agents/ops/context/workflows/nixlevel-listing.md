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

**JNix has NO Printify Premium subscription (confirmed 2026-07-17) — always compute margins on the standard base-cost column. Premium columns are reference-only.**
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

Margin facts (verified on live listings 2026-07-17):

- **Hoodie** offers seller-paid FREE shipping → repriced to **$48.99 (S–XL) / $52.99 (2XL+)** on 2026-07-17 to clear the 30% floor after Etsy fees (~9.5%). Any new free-shipping hoodie must price at these levels or above.
- **Tee** uses buyer-paid shipping ($4.75, free over $35 shop-wide); variants mostly $29.99–$32.99 (XS from $22.87) → margins ~40–52% after fees, no floor issue. New buyer-paid-shipping tees are safe from ~$19 up.
- Rule of thumb: seller-paid free shipping costs $7.69/unit (hoodie) — always add it to cost before computing margin.

## DATA loop specifics

- **Diagnose:** Check inputs above are filled; if a TODO is empty, escalate before generating.
- **Assemble:** Plan the 6 artifacts; reuse `tools/` templates if present.
- **Take Action:** Generate artifacts into the output folder.
- **Assess:** Verify every Definition-of-Done box; check tag lengths and title chars programmatically, not by eye.

## Escalation rules

- Margin below 30% → flag, don't pick the price yourself.
- Trademark-risky phrases in title/tags → flag.
- Nothing is uploaded to Etsy at this stage — JNix uploads after review.
