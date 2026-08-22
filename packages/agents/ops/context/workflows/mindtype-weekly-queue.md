---
name: mindtype-weekly-queue
trust_stage: 2
publish_target: none
inputs:
  weekly_theme:
    type: string
    required: true
    periodic: false
    description: Weekly theme or emotional focus (e.g. boundaries, rest as productivity)
  past_examples:
    type: string
    required: false
    periodic: false
    description: 2-3 best-performing past posts to mirror
  hashtag_bank:
    type: string
    required: false
    periodic: true
    description: Current hashtag bank
  campaign_tie_in:
    type: string
    required: false
    periodic: false
    description: Current campaign or launch to tie into
---

# Workflow: MindType.Studio weekly content queue

**Use when:** you need this week's MindType.Studio post queue (carousel, quote, story) from a weekly theme or emotional focus.
**Rule of R score:** Repetitive ✅ Rule-based ✅ Return on time ✅ — the same 3-post cadence runs every week.
**Trust stage:** 2 (approve everything first)

## Aim (WHY before HOW)

WHY: The weekly cadence — one carousel, one quote post, one story sequence — is a fixed, template-driven shape once the week's theme is picked, and repeating that structure by hand is exactly the kind of work that's delegable without losing the brand's voice.
OUTCOME: A weekly theme or emotional focus goes in; three ready-to-design posts (carousel outline, quote copy, story sequence) plus captions come out.

## Definition of Done

A week's queue is DONE when all of these exist in `output/mindtype/<week-slug>/`:

- [ ] `carousel.md` — 5-7 slide carousel: 4:5 vertical portrait aspect ratio; each slide's on-image text (short, poetic — per IDENTITY.md's MindType voice), post caption, and a Save/Share CTA
- [ ] `quote.md` — one quote-graphic line (≤25 words) formatted for 1:1 square or 4:5, plus its caption and a Comment/Engagement CTA
- [ ] `story.md` — 3-5 frame Story sequence: 9:16 full-screen vertical aspect ratio; on-screen text per frame, suggested sticker/poll, and an Interactive Link/Poll CTA
- [ ] `captions.md` — all three captions consolidated, each with its own hashtag set (unique broad, niche, and brand tags per post) — not the same set copy-pasted three times
- [ ] Self-assessed against every checklist item; CTA diversity verified across all 3 posts; gaps fixed before reporting

## Inputs (Camcorder Method — fill from a recorded run)

- Weekly theme / emotional focus from JNix (e.g. "boundaries," "rest as productivity")
- Brand voice examples — 2-3 best-performing past posts to mirror: _SETTING: JNix pastes examples_
- Current hashtag bank (not a stale saved set): _SETTING_PERIODIC: JNix pastes current hashtags_
- Any current campaign or launch to tie into, if applicable: _TODO: JNix notes it here, or leaves blank if none_

## DATA loop specifics

- **Diagnose:** Check the theme is specific enough to write from — a vague theme like "wellness" produces generic posts. If it's too broad, escalate for a sharper angle before generating rather than guessing one. Check inputs above are filled.
- **Assemble:** Plan the three posts so they approach the theme from different angles — no shared opening line or duplicated hook across them.
- **Take Action:** Produce every artifact in full.
- **Assess:** Verify slide/frame counts against the Definition of Done. Verify the three posts don't repeat the same opening line or visual metaphor.

## Escalation rules

- A theme that brushes against clinical mental-health territory (diagnosis, treatment, crisis language) → flag, keep the post experiential and poetic, not prescriptive advice — that's a liability line, not a style choice.
- Nothing is scheduled or posted at this stage — this workflow only produces drafts for JNix to review.
