# Workflow: SEO article package

**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — every SEO article needs the same fixed pipeline once a topic or seed keyword is picked.
**Trust stage:** 2 (approve everything first)
**Publish target:** wordpress

## Aim (WHY before HOW)

WHY: A topic or seed keyword needs the same sequence every time before it's publish-ready — keyword research, then a content brief, then a full draft, then meta data — and skipping stages (writing straight to a draft) produces content that doesn't actually target anything searchable.
OUTCOME: A topic or seed keyword goes in; a full SEO-optimized article package (keyword research, content brief, article, meta data) comes out, ready for JNix to review and publish.

## Definition of Done

An SEO article package is DONE when all of these exist in `output/seo-articles/<slug>/`:

- [ ] `keyword-research.md` — primary keyword, estimated monthly search volume (low/medium/high), estimated keyword difficulty (low/medium/high), search intent (informational/navigational/commercial/transactional), 5-8 secondary keywords, 10-15 NLP/LSI terms, People Also Ask questions
- [ ] `content-brief.md` — working title, target keyword, secondary keywords, word count target, tone of voice, target audience, search intent, competitors-to-beat description, full outline (H1 → H2s → H3s including an FAQ section drawing on the People Also Ask questions and a conclusion), internal link opportunities, external link suggestions (source types, not invented URLs), featured snippet opportunity (yes/no + format)
- [ ] `article.md` — full long-form body following the approved brief exactly: one H1, logical H2/H3 hierarchy, primary keyword in the H1 and first 100 words, secondary/NLP keywords distributed naturally (never stuffed), short paragraphs (2-4 sentences), at least one list or table, key terms bolded on first meaningful use, `[IMAGE SUGGESTION: ...]` placeholders where visuals help, `[INTERNAL LINK: anchor text → page type]` for 2-4 internal links, `[EXTERNAL LINK: anchor text → source type]` for 1-3 citations, FAQ section, clear conclusion — written with the humanization rules below, not corporate-clean prose
- [ ] `meta.md` — title tag (50-60 chars), meta description (150-160 chars), URL slug, OG title, OG description, focus keyword
- [ ] Self-assessed against every checklist item above; gaps fixed before reporting done

**Humanization rules for `article.md` (non-negotiable):** contractions used naturally; sentence length varies — short ones punch, longer ones build context; occasional sentences start with "And," "But," or "So"; at least one moment of honest opinion or mild skepticism where it genuinely fits; specific concrete language over vague generalities; no filler transitions ("Furthermore," "Moreover," "It is important to note," "In conclusion"); no relentless AI positivity. A reader should finish thinking "someone who knows this stuff wrote this," not "this came from a content farm."

## Inputs (Camcorder Method — fill from a recorded run)

- Topic or seed keyword from JNix
- Target audience and tone, if not obvious from the topic: _SETTING: JNix fills a default here once established — still overridable per-run in the brief if a specific article needs something different_
- House style guide or 2-3 example past articles to mirror: _SETTING: JNix pastes link or examples_
- Site/brand this article is for (affects internal link targets and voice — e.g. TechTrendWire vs. another property): _SETTING: JNix confirms the default property — override per-run in the brief if writing for a different one_

## DATA loop specifics

- **Diagnose:** Confirm a topic or seed keyword is actually given — this workflow can't run on a vague prompt like "write something about AI." Check inputs above are filled; escalate on any unfilled TODO that would materially change the brief (audience/tone, target site).
- **Assemble:** Run keyword research first (`keyword-research.md`), grounded in what real searchers would type and what competing pages likely cover — not just synonyms. Then build the content brief (`content-brief.md`) from that research: outline, word count target, and link opportunities, planned before any article prose is written.
- **Take Action:** Write the full article (`article.md`) strictly following the approved brief's outline and targets, then generate the meta package (`meta.md`) from the finished article — the meta description should reflect what the article actually delivers, not what the brief predicted it would.
- **Assess:** Verify meta character counts programmatically, not by eye (title ≤60 chars, description ≤160 chars). Verify the article's headings actually match the brief's outline — cut or flag any drift. Scan for AI-tell phrases from the humanization rules ("Furthermore," "It's worth noting," etc.) and rewrite any that slipped through rather than letting them stand.

## Escalation rules

- A keyword claim, search volume estimate, or competitive detail that's just a guess and stated as fact → mark it as an estimate in `keyword-research.md`, don't present it as verified data.
- A factual claim in the article that can't be grounded in the topic/source material given → cut it, don't hedge it into vague language and leave it in.
- Once approved, the article and its meta data are pushed to WordPress as a **draft** — never as a live, published post. Going live stays a separate, manual action JNix takes in the WordPress dashboard. If the WordPress push fails (missing credentials, site unreachable), the run still counts as approved and complete — the draft push is delivery, not part of the DATA loop's own definition of done — and the failure is reported so JNix can copy the article in manually.
- `[IMAGE SUGGESTION: ...]` markers are auto-generated into real images and uploaded as the post's inline/featured images at delivery time (Pollinations, free/open-model backed) — if generation or upload fails for any individual image, that one falls back to the plain suggestion text rather than blocking the rest of the article.
- `[INTERNAL LINK: ...]` markers are auto-matched against JNix's real, already-published WordPress posts at delivery time — a link is only ever inserted when a genuine title match exists; no match means the anchor text stays as plain, unlinked text. The model never invents a URL for this.
- A relevant YouTube video may be auto-embedded near the end of the article if a good match exists (any channel, not just JNix's own) — skipped entirely if nothing relevant turns up, or if no YouTube API credentials are configured yet.
