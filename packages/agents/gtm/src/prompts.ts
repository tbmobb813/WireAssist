import type { GtmProductInput } from './types';

function parsePrice(price: string): number {
  const n = parseFloat(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 49;
}

export function buildGtmPrompt(p: GtmProductInput): string {
  return `You are a world-class go-to-market strategist and B2B SaaS marketing expert.

Generate a complete, highly specific, immediately actionable GTM strategy for this product:

PRODUCT: ${p.name}
CATEGORY: ${p.cat}
PROBLEM SOLVED: ${p.problem}
CORE BENEFIT: ${p.benefit}
DIFFERENTIATOR: ${p.diff}
TARGET BUYER: ${p.buyer}
SEGMENT: ${p.segment}
COMPETITORS: ${p.comp}
WHERE BUYERS HANG OUT: ${p.channels}
BUYER FRUSTRATIONS WITH CURRENT OPTIONS: ${p.pain}
PRICE: ${p.price}
BUSINESS MODEL: ${p.model}
FREE TIER/TRIAL: ${p.free}
PHASE 1 GOAL: ${p.goal}
CURRENT MARKETING: ${p.current}
BUDGET: ${p.budget}

Return ONLY a valid JSON object with this exact structure (no markdown, no backticks, no preamble):
{
  "positioning": {
    "headline": "one punchy positioning statement under 12 words",
    "subheadline": "one sentence expanding on the positioning",
    "icp": "precise description of ideal customer profile",
    "message_hierarchy": ["primary message", "secondary message", "tertiary message"]
  },
  "organic_channels": [
    {
      "channel": "channel name",
      "effort": "Low|Medium|High",
      "impact": "HIGH|MED|LOW",
      "timeframe": "when to expect results",
      "tactics": ["specific tactic 1", "specific tactic 2", "specific tactic 3"]
    }
  ],
  "paid_channels": [
    {
      "channel": "channel name",
      "priority": 1,
      "budget": "suggested budget",
      "when_to_start": "timing recommendation",
      "key_tactic": "the most important thing to do on this channel"
    }
  ],
  "launch_timeline": [
    { "week": "Week 1", "focus": "focus area", "tasks": ["task 1", "task 2", "task 3"] },
    { "week": "Week 2", "focus": "focus area", "tasks": ["task 1", "task 2", "task 3"] },
    { "week": "Week 3", "focus": "focus area", "tasks": ["task 1", "task 2", "task 3"] },
    { "week": "Week 4", "focus": "focus area", "tasks": ["task 1", "task 2", "task 3"] }
  ],
  "kpis": [
    { "metric": "metric name", "target": "specific target", "why": "why this matters" }
  ],
  "north_star": "the single most important metric to track",
  "founder_advantage": "specific advice on using founder story/background as marketing asset",
  "biggest_risk": "the single biggest GTM risk and how to mitigate it"
}

Be brutally specific to THIS product. No generic advice. Reference the actual product name, actual competitors, actual buyer personas, actual communities.`;
}

export function buildPsychPrompt(p: GtmProductInput): string {
  const price = parsePrice(p.price);
  const daily = (price / 30).toFixed(2);
  const mid = Math.round((price * 1.4) / 5) * 5;
  const top = Math.round((price * 3) / 5) * 5;

  return `You are an expert in behavioral economics and conversion psychology.

Apply all 9 psychological marketing principles to this specific product:

PRODUCT: ${p.name} (${p.cat})
PROBLEM: ${p.problem}
BENEFIT: ${p.benefit}
DIFFERENTIATOR: ${p.diff}
BUYER: ${p.buyer}
PRICE: ${p.price} ($${daily}/day, mid tier ~$${mid}/mo, top tier ~$${top}/mo)
COMPETITOR: ${p.comp}
FREE TIER: ${p.free}

Return ONLY a valid JSON array (no markdown, no backticks) with exactly 9 objects, one per principle in this order:
1. Sell Benefits Not Features
2. Affordability Illusion
3. Rule of 3
4. IKEA Effect
5. Power of Free
6. Contrast Effect
7. Paradox of Choice
8. Anchoring Bias
9. Endowment Effect

Each object:
{
  "principle": "principle name",
  "tagline": "one-line explanation of the principle",
  "generic_bad": "generic wrong example (3-8 words)",
  "generic_good": "generic right example (3-8 words)",
  "headline": "specific headline for applying this to ${p.name}",
  "tactics": ["specific tactic 1 for ${p.name}", "specific tactic 2", "specific tactic 3", "specific tactic 4"],
  "tags": ["tag1", "tag2", "tag3"]
}

Every tactic must reference ${p.name} specifically, use real numbers from the product, name the actual buyer or competitors. Zero generic advice.`;
}
