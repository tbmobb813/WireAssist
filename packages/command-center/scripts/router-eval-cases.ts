import type { RouteDecision } from '../src/api/chat-router';

export interface RouterEvalCase {
  prompt: string;
  expectedKind: RouteDecision['kind'];
  // Why this case exists — usually because the system prompt has an
  // explicit rule for it, meaning some past confusion already happened
  // here. Printed alongside a failure so a miss points straight at which
  // documented rule the model didn't follow.
  notes: string;
}

// Every case below traces back either to an explicit rule already written
// into chat-router.ts's SYSTEM_PROMPT (meaning: this exact confusion
// already happened once) or to baseline coverage of a route kind that had
// no case at all. This is the "unverified beyond prompt engineering" gap
// from the WireAssist readiness assessment — running this against the real
// classifier turns each documented rule into something that can actually
// fail loudly instead of just being prose nobody checks.
export const ROUTER_EVAL_CASES: RouterEvalCase[] = [
  // ── admin_freeform: vague/general, explicitly NOT triage or calendar ──
  {
    prompt: 'how are things looking today?',
    expectedKind: 'admin_freeform',
    notes: 'Vague status check — must not fall to admin_triage/admin_calendar.',
  },
  {
    prompt: 'I have a bunch of half-done stuff, what should I actually do?',
    expectedKind: 'admin_freeform',
    notes: 'Vague productivity ask, no named subject.',
  },
  {
    prompt: 'who was the first president of the United States?',
    expectedKind: 'admin_freeform',
    notes: 'Stable general-knowledge fact — must NOT route to research (it never changes).',
  },
  {
    prompt: 'help me get organized',
    expectedKind: 'admin_freeform',
    notes: "Explicitly named in the system prompt's own worked example.",
  },

  // ── admin_triage: explicit "email"/"inbox" ──
  {
    prompt: 'go through my inbox and triage everything',
    expectedKind: 'admin_triage',
    notes: 'Explicitly names inbox + triage.',
  },
  {
    prompt: 'clean up my email',
    expectedKind: 'admin_triage',
    notes: 'Explicitly names email.',
  },

  // ── admin_calendar: explicit "calendar"/"schedule"/"meetings" ──
  {
    prompt: "what's on my calendar today?",
    expectedKind: 'admin_calendar',
    notes: 'Explicitly names calendar.',
  },
  {
    prompt: 'any meetings tomorrow?',
    expectedKind: 'admin_calendar',
    notes: 'Explicitly names meetings.',
  },

  // ── content_generate vs content_plan vs content_freeform ──
  {
    prompt: 'write a tweet announcing our new feature',
    expectedKind: 'admin_freeform',
    notes:
      'Consistently (8/8 at temperature: 0) routes here rather than content_generate, because ' +
      'content_generate\'s required `topic` field has nothing concrete to fill ("our new feature" ' +
      'names no actual feature) and that tool has no way to ask a clarifying question — so bailing ' +
      'to admin_freeform, whose tool loop can ask what the feature is before delegating to Content, ' +
      'is the more defensible behavior. A version of this prompt with a real topic (e.g. "write a ' +
      'tweet about our new dark mode feature") is the better test of platform inference.',
  },
  {
    prompt: 'write a tweet about our new dark mode feature',
    expectedKind: 'content_generate',
    notes: 'Single post, one platform, with an actual concrete topic to fill.',
  },
  {
    prompt: 'build me a content calendar for the next 3 weeks across twitter and linkedin',
    expectedKind: 'content_plan',
    notes: 'Multi-post plan across platforms.',
  },
  {
    prompt: 'how has our content been performing lately?',
    expectedKind: 'content_freeform',
    notes: 'Question about existing posts, not a new-content request.',
  },

  // ── research_topic: including the "live fact, not general knowledge" rule ──
  {
    prompt: "what's the current price of a PS5?",
    expectedKind: 'research_topic',
    notes:
      'Time-sensitive live fact phrased as a short question — the system prompt has an explicit ' +
      'rule this must NOT fall to admin_freeform.',
  },
  {
    prompt: "what's the latest version of Node.js?",
    expectedKind: 'research_topic',
    notes: 'Live/changing fact, not stable general knowledge.',
  },
  {
    prompt: 'research trending back-to-school products to sell on Etsy',
    expectedKind: 'research_topic',
    notes: "Selling intent present — offerOpsWorkflow should be set to 'nixlevel-listing'.",
  },
  {
    prompt: 'research current market trends in AI coding tools',
    expectedKind: 'research_topic',
    notes: 'Baseline single-topic research request.',
  },

  // ── research_freeform: compound/follow-up ──
  {
    prompt:
      'look up the current AMD Ryzen lineup and tell me how it compares to what we found last time',
    expectedKind: 'research_freeform',
    notes: 'Compound: search + synthesis against prior findings.',
  },

  // ── ops_freeform vs ops_workflow ──
  {
    prompt: 'what workflows do we have set up in NixOps?',
    expectedKind: 'ops_freeform',
    notes: 'General question, no named workflow to run.',
  },
  {
    prompt: 'run the nixlevel-listing workflow for winter apparel',
    expectedKind: 'ops_workflow',
    notes: 'Names a concrete, real workflow.',
  },

  // ── gtm_freeform vs gtm_redirect ──
  {
    prompt: 'what pricing model works best for a subscription SaaS?',
    expectedKind: 'gtm_freeform',
    notes: 'General GTM discussion, not a build request.',
  },
  {
    prompt: 'build a full go-to-market strategy for WireAssist',
    expectedKind: 'gtm_redirect',
    notes: 'Explicit generate/build request for a specific product.',
  },

  // ── github_freeform: must win over research even though it reads like a lookup ──
  {
    prompt: 'what are the open issues on the WireAssist repo?',
    expectedKind: 'github_freeform',
    notes: 'Repo-specific — the system prompt has an explicit rule this beats research_freeform.',
  },
  {
    prompt: 'comment on PR #12 saying it looks good',
    expectedKind: 'github_freeform',
    notes: 'Direct repo write action.',
  },

  // ── compound requests: must NOT force into one narrow tool ──
  {
    prompt: 'check my email and my calendar and tell me if I have anything urgent',
    expectedKind: 'admin_freeform',
    notes:
      'Compound admin-shaped request (inbox + calendar) — the system prompt says this must NOT ' +
      'be forced into just admin_triage or admin_calendar.',
  },
];
