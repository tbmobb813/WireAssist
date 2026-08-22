---
name: article-package
trust_stage: 2
publish_target: wordpress
inputs:
  starting_point:
    type: string
    required: true
    periodic: false
    description: EITHER a topic/seed keyword OR a news source article link
  target_audience:
    type: string
    required: false
    periodic: false
    description: Target audience and tone
  house_style:
    type: string
    required: false
    periodic: false
    description: House style guide or example past articles to mirror
  site_brand:
    type: string
    required: false
    periodic: false
    description: Target site/brand (e.g. TechTrendWire)
  byline:
    type: string
    required: false
    periodic: false
    description: Byline / author attribution to use
  target_community:
    type: string
    required: false
    periodic: false
    description: Target subreddits/communities for crosspost summary
---

# Workflow: Article package (SEO + TechTrendWire)

**Use when:** you need a blog article — either built from scratch around a topic/keyword, or written to react to a specific news source — optionally repackaged for social. State which starting point in the brief.
**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — every published piece needs the same core article + meta, with optional add-ons depending on the starting point.
**Trust stage:** 2 (approve everything first)
**Publish target:** wordpress

## Aim (WHY before HOW)

WHY: A blog article needs the same core pipeline every time — research or source-check, then a full draft, then meta data — whether it starts from a bare keyword or a specific news story to react to. Skipping stages (writing straight to a draft) produces content that doesn't target anything searchable, or that isn't actually traceable to a real source.
OUTCOME: A topic/seed keyword OR a news source article/link goes in; a publish-ready article + SEO meta comes out, with keyword research and a content brief added for the keyword-driven path, and a Shorts script + crosspost package added for the news-source path (or whenever social distribution is requested).

## Definition of Done

An article package is DONE when all of these exist in `output/article-package/<slug>/`:

- [ ] `article.md` — full long-form body: one H1, logical H2/H3 hierarchy (including secondary/LSI keywords in at least 2 H2 subheadings), primary keyword or topic in the H1 and first 100 words, short paragraphs (2-4 sentences), at least one list or table, key terms bolded on first meaningful use, `[IMAGE SUGGESTION: ...]` placeholders where visuals help, `[INTERNAL LINK: anchor text → page type]` for 2-4 internal links, `[EXTERNAL LINK: anchor text → source type]` for 1-3 citations, FAQ section, clear conclusion — every factual claim traceable to real source material — written with the humanization rules below, not corporate-clean prose
- [ ] `meta.md` — title tag (≤60 chars), meta description (≤160 chars), URL slug, OG title, OG description, focus keyword/topic, WordPress Category, and comma-separated WordPress Tags
- [ ] **Keyword-driven path only:** `keyword-research.md` (primary keyword, estimated search volume and difficulty low/medium/high, search intent, 5-8 secondary keywords, 10-15 NLP/LSI terms, People Also Ask questions) and `content-brief.md` (working title, target keyword, secondary keywords, word count target, tone, target audience, search intent, competitors-to-beat description, full outline including an FAQ section and a conclusion, internal/external link opportunities, featured snippet opportunity) — produced and approved internally before `article.md` is written, never skipped straight to a draft
- [ ] **News-source path, or whenever social distribution is requested:** `shorts-script.md` (45-60s vertical video script: hook in the first 3 seconds, 3-4 beats, closing CTA) and `crosspost.md` (a 5-7 tweet X/Twitter thread, a LinkedIn post, and a summary framed for the relevant community)
- [ ] Self-assessed against every checklist item that applies to this run's path; gaps fixed before reporting done

**Humanization rules for `article.md` (non-negotiable, every run regardless of path):** contractions used naturally; sentence length varies — short ones punch, longer ones build context; occasional sentences start with "And," "But," or "So"; at least one moment of honest opinion or mild skepticism where it genuinely fits; specific concrete language over vague generalities; no filler transitions ("Furthermore," "Moreover," "It is important to note," "In conclusion"); no relentless AI positivity. A reader should finish thinking "someone who knows this stuff wrote this," not "this came from a content farm."

## Inputs (Camcorder Method — fill from a recorded run)

- Starting point: EITHER a topic/seed keyword (general SEO content, no existing source to react to) OR a news source article/link (reactive/timely content) — state which in the brief. Any setting below can be overridden for one run by just saying so in the brief.
- Target audience and tone, if not obvious from the topic: _SETTING: JNix fills a default here once established_
- House style guide or 2-3 example past articles to mirror: _SETTING: JNix pastes link or examples_
- Site/brand this article is for (affects internal link targets and voice — e.g. TechTrendWire vs. another property): _SETTING: JNix confirms the default property_
- Byline / author attribution to use: _SETTING: JNix confirms current byline_
- Target community/subreddit(s) for the crosspost summary, when social distribution applies: _SETTING: JNix pastes current go-to communities_

## DATA loop specifics

- **Diagnose:** First determine which starting point this run is — a bare topic/keyword, or a specific news source/link — this decides which optional artifacts below apply. Keyword path: this workflow can't run on a vague prompt like "write something about AI." News-source path: confirm the source is real, accessible, and recent — flag if the primary source is stale (more than ~72 hours old), since a late "hot take" wastes the cycle it was meant to save. Check inputs above are filled; escalate on any unfilled SETTING that would materially change the brief (audience/tone, target site) — never invent a plausible-sounding value for it.
- **Assemble:** Keyword path — run keyword research first (`keyword-research.md`), grounded in what real searchers would type, then build `content-brief.md` from that research before any article prose is written. News-source path — plan which specific source backs each factual claim before writing; a claim with no traceable source doesn't go in the plan. Either path — decide now whether `shorts-script.md`/`crosspost.md` apply to this run (always for the news-source path, only if explicitly requested on the keyword path).
- **Take Action:** Write `article.md` (following the approved brief's outline on the keyword path, or the sourced claim-map on the news-source path), then `meta.md`. Produce `shorts-script.md` + `crosspost.md` only when this run's path calls for them.
- **Assess:** Verify meta character counts programmatically, not by eye. Scan for AI-tell phrases from the humanization rules ("Furthermore," "It's worth noting," etc.) and rewrite any that slipped through — this check applies to every run, regardless of path. Keyword path additionally: verify the article's headings match the brief's outline, cut or flag any drift. News-source path additionally: verify every factual claim in `article.md` traces back to a specific cited source — cut anything that doesn't, don't soften it into a hedge and keep it.

## Escalation rules

- A keyword claim, search volume estimate, or competitive detail that's just a guess and stated as fact (keyword path) → mark it as an estimate in `keyword-research.md`, don't present it as verified data.
- A claim that can't be traced to source material (either path) → cut it, don't hedge it into vague language and leave it in.
- Anything legally sensitive — defamation risk, unverified allegations about a company or person (news-source path especially) → escalate, do not include in the draft.
- Once approved, auto-publish to WordPress as a **draft** applies only to the keyword-driven general-content path — never as a live, published post, and going live stays a separate manual action JNix takes in the WordPress dashboard. A news-source-path run always stops at draft-for-review without any auto-publish attempt, regardless of trust stage, since time-sensitive/reactive content needs a human look before it's anywhere public. If the WordPress push fails on the keyword path (missing credentials, site unreachable), the run still counts as approved and complete — the draft push is delivery, not part of the DATA loop's own definition of done — and the failure is reported so JNix can copy the article in manually.
- `[IMAGE SUGGESTION: ...]` markers are auto-generated into real images and uploaded as the post's inline/featured images at delivery time (Pollinations, free/open-model backed) — if generation or upload fails for any individual image, that one falls back to the plain suggestion text rather than blocking the rest of the article.
- `[INTERNAL LINK: ...]` markers are auto-matched against JNix's real, already-published WordPress posts at delivery time — a link is only ever inserted when a genuine title match exists; no match means the anchor text stays as plain, unlinked text. The model never invents a URL for this.
- A relevant YouTube video may be auto-embedded near the end of the article if a good match exists (any channel, not just JNix's own) — skipped entirely if nothing relevant turns up, or if no YouTube API credentials are configured yet.
