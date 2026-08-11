# Workflow: TechTrendWire article + SEO + Shorts + crosspost package

**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — every published piece needs the same four artifacts.
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: Every article needs a draft, SEO metadata, a Shorts script, and platform-specific repackaging — a fixed pipeline once a topic and sources are picked, and news value decays fast enough that manual repackaging often means the moment's gone before crossposting happens.
OUTCOME: A news topic and its source article(s) go in; a publish-ready article plus SEO meta, a Shorts script, and a crosspost package come out.

## Definition of Done

An article is DONE when all of these exist in `output/techtrendwire/<article-slug>/`:

- [ ] `article.md` — headline, dek, body in TechTrendWire's analytical, accessible tech-journalism voice (per IDENTITY.md), with every factual claim linked inline to a specific source
- [ ] `seo-meta.md` — meta title (≤60 chars), meta description (≤155 chars), 5-8 target keywords, suggested URL slug
- [ ] `shorts-script.md` — 45-60s vertical video script: hook (first 3 seconds), 3-4 beats, closing CTA
- [ ] `crosspost.md` — platform-specific repackaging: a 5-7 tweet X/Twitter thread, a LinkedIn post, and a summary framed for the relevant community
- [ ] Self-assessed against every checklist item; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- News topic + source article(s)/links from JNix
- Target community/subreddit(s) for the crosspost summary: _TODO: JNix pastes current go-to communities_
- House style guide or 2-3 example past articles to mirror: _TODO: JNix pastes link or examples_
- Byline / author attribution to use: _TODO: JNix confirms current byline_

## DATA loop specifics

- **Diagnose:** Confirm the source article(s) are real, accessible, and recent — news value decays fast, so flag if the primary source is stale (e.g. more than ~72 hours old) since a late "hot take" wastes the cycle it was meant to save. Check inputs above are filled; escalate on any unfilled TODO.
- **Assemble:** Plan the four artifacts, and plan which specific source backs each factual claim before writing — a claim with no traceable source doesn't go in the plan.
- **Take Action:** Produce every artifact in full.
- **Assess:** Verify SEO meta character counts programmatically, not by eye. Verify every factual claim in `article.md` traces back to a specific cited source — cut anything that doesn't, don't soften it into a hedge and keep it.

## Escalation rules

- A claim that can't be traced to a source → cut it from the draft, flag it in the run report, don't publish it as fact.
- Anything legally sensitive — defamation risk, unverified allegations about a company or person → escalate, do not include in the draft.
- Nothing is published or posted anywhere at this stage — this workflow only produces drafts for JNix to review and publish.
