import type { Skill } from '@wireassist/core';
import { OpsTasks } from '@wireassist/agent-ops';

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

interface StageResult {
  stage: 'expand' | 'reddit_search' | 'extract_pain_points' | 'generate_gaps';
  content: string;
}

// The real, phone-book of first-person pain-point language this search
// targets — pulled from a "Starter Story" market-research prompt chain
// JNix supplied, not invented. Reddit's own official API has required paid
// commercial licensing and restricted automated querying since mid-2023;
// going through Brave's search index (which supports the same `site:`
// operator Google does) sidesteps that entirely, since this only ever reads
// what's already publicly indexed.
const PAIN_POINT_PHRASES = [
  'i think',
  'i feel',
  'i was',
  'i have been',
  'i experienced',
  'my experience',
  'in my opinion',
  'imo',
  'my biggest struggle',
  'my biggest fear',
  'i found that',
  'i learned',
  'i realized',
  'my advice',
  'struggles',
  'problems',
  'issues',
  'challenge',
  'difficulties',
  'hardships',
  'pain point',
  'barriers',
  'obstacles',
  'concerns',
  'frustrations',
  'worries',
  'hesitations',
  'what i wish i knew',
  'what i regret',
];

function buildRedditQuery(niche: string): string {
  const intext = PAIN_POINT_PHRASES.map((p) => `intext:"${p}"`).join('|');
  return `"${niche}" (site:reddit.com inurl:comments|inurl:thread | ${intext})`;
}

export interface MarketGapDiscoveryInput {
  // What to explore — defaults to NixLevel's established real product type
  // (per the actual approved runs so far: digital printables) rather than
  // inventing a broader taxonomy with no grounding in what NixLevel
  // actually sells today. Pass something more specific (e.g. "home
  // organization printables") to narrow the expand stage.
  marketFocus?: string;
  offerOpsHandoff?: { workflow: string };
}

export const marketGapDiscoverySkill: Skill<MarketGapDiscoveryInput, void> = {
  name: 'market_gap_discovery',
  role: 'research',
  description:
    'Multi-stage pipeline: expand a market into specific niches, search Reddit for real ' +
    'first-person pain-point language, extract and categorize those pain points, then ' +
    'generate ranked market-gap product concepts from them.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const marketFocus =
      input.marketFocus?.trim() ||
      'digital printables and physical print-on-demand products sellable on Etsy';

    const stages: StageResult[] = [];

    const stage = async (
      name: StageResult['stage'],
      instruction: string,
      extra?: string
    ): Promise<string> => {
      const content = await agent.think(
        [
          `MARKET FOCUS: ${marketFocus}`,
          extra ? `PRIOR STAGE OUTPUT:\n${extra}` : '',
          `CURRENT STAGE — ${name.toUpperCase()}:\n${instruction}`,
        ]
          .filter(Boolean)
          .join('\n\n')
      );
      stages.push({ stage: name, content });
      agent.emit('agent:market_gap_stage_complete', {
        agentRole: task.agentRole,
        taskId: task.id,
        stage: name,
      });
      return content;
    };

    // ── Stage 1: Expand the market focus into specific, searchable niches ──
    const expansion = await stage(
      'expand',
      'You are a business strategy and market segmentation expert. Break the market focus ' +
        'above down into specific categories, then niches, then sub-niches — as many as you ' +
        'can, avoiding overlap between them. Each should be unique and specific enough to ' +
        'search for real user discussion about (not a vague category like "home decor" but ' +
        'a specific niche like "wall-mounted planners for renters").\n\n' +
        'End with exactly one line: "NICHES: niche one; niche two; niche three" naming your ' +
        'top 3 most promising specific niches, semicolon-separated, in priority order — this ' +
        'line is parsed by code, so it must match this exact format with nothing else on it.'
    );

    const nichesMatch = expansion.match(/^NICHES:\s*(.+)$/m);
    const niches = (nichesMatch?.[1] ?? marketFocus)
      .split(';')
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 3);

    // ── Stage 2: Search Reddit (via Brave's site: support) for each niche ──
    const redditFindings: { niche: string; results: BraveResult[] }[] = [];
    for (const niche of niches) {
      try {
        const searchResult = (await agent.useTool('brave_search', {
          query: buildRedditQuery(niche),
          count: 15,
        })) as { results: BraveResult[] };
        redditFindings.push({ niche, results: searchResult.results ?? [] });
      } catch (err) {
        redditFindings.push({ niche, results: [] });
        agent.emit('agent:market_gap_search_failed', {
          agentRole: task.agentRole,
          taskId: task.id,
          niche,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const redditSummary = redditFindings
      .map(
        ({ niche, results }) =>
          `### Niche: ${niche}\n` +
          (results.length
            ? results
                .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`)
                .join('\n\n')
            : '(no results found for this niche)')
      )
      .join('\n\n');

    await stage(
      'reddit_search',
      'The search results above were just gathered for each niche — no further reasoning ' +
        'needed at this stage, this stage exists only to record what was found. State plainly ' +
        'which niches returned strong signal (many results with real first-person language) ' +
        'versus weak or no signal, so the extraction stage below knows where to focus.',
      redditSummary
    );

    // ── Stage 3: Extract pain points from what was found ──
    const painPoints = await stage(
      'extract_pain_points',
      'You are an expert Market Research Analyst. Analyze the Reddit search results above to ' +
        'identify pain points, frustrations, and unmet needs expressed by real users.\n\n' +
        "IMPORTANT LIMITATION: you only have each result's title, URL, and a short description " +
        'snippet from search indexing — not the full thread or comment text. Extract only what ' +
        'the snippet actually shows; never invent or extrapolate a fuller quote than what is ' +
        'literally present. Note plainly that this is snippet-level signal, not full-thread ' +
        'analysis, and is directionally useful rather than exhaustive.\n\n' +
        'INCLUDE: specific problems, frustrations with existing solutions, unmet needs/desires, ' +
        'workarounds users mention, emotional impact — all only from what the snippet text ' +
        'actually contains.\n' +
        "DO NOT INCLUDE: general discussion, vague complaints, anything the snippet doesn't " +
        'actually support.\n\n' +
        'Output: a Pain Point Analysis Summary, then Categorized Pain Points (thematic ' +
        'categories, each with a short summary and the exact snippet text that supports it — ' +
        'preserve exact original wording, no modification), then a Priority Ranking by ' +
        'apparent frequency, intensity, specificity, and potential solvability.',
      redditSummary
    );

    // ── Stage 4: Generate market-gap product concepts from the pain points ──
    const gapAnalysis = await stage(
      'generate_gaps',
      'You are an expert Business Opportunity Strategist. Using the pain points above, generate ' +
        'potential product concepts using these frameworks: (1) Market Segmentation — ' +
        'underserved sub-niches; (2) Product Differentiation — premium/simplified/specialized ' +
        'versions; (3) Business Model Innovation — subscription/one-time/bundle approaches; ' +
        '(4) Distribution & Marketing — underused channels or angles; (5) New Paradigm — ' +
        'emerging trends or entirely new framings.\n\n' +
        'For each concept: a clear name, 2-3 sentence explanation, key features, primary value ' +
        'proposition, and exactly how it addresses a specific pain point identified above — ' +
        "never a concept that isn't traceable back to a real pain point in this run's findings.\n\n" +
        'Conclude with a ranked top 3 by market size/growth potential, competitive-advantage ' +
        'sustainability, and implementation feasibility for a small Etsy shop (not a funded ' +
        'startup) — favor concepts buildable as a single listing or small batch, not ones ' +
        'requiring new infrastructure.\n\n' +
        'End with exactly one line: "TOP CONCEPT: <name>" naming the single highest-ranked ' +
        'concept — this line is parsed by code, so it must match this exact format.',
      painPoints
    );

    const topConceptMatch = gapAnalysis.match(/^TOP CONCEPT:\s*(.+)$/m);
    const topConcept = topConceptMatch?.[1]?.trim();

    const fullReport = stages.map((s) => `### ${s.stage.toUpperCase()}\n${s.content}`).join('\n\n');

    agent.emit('agent:research_complete', {
      agentRole: task.agentRole,
      taskId: task.id,
      summary: gapAnalysis,
      sources: redditFindings.flatMap(({ results }) => results.map((r) => r.url)),
    });

    const approved = await agent.proposeAction(
      task,
      `Store market-gap discovery findings for: ${marketFocus}`,
      { summary: fullReport }
    );
    if (approved) {
      agent.remember(`Market-gap discovery on "${marketFocus}":\n\n${fullReport}`, [
        'market-gap-discovery',
        'findings',
        ...marketFocus.toLowerCase().split(' ').slice(0, 3),
      ]);
    }

    if (input.offerOpsHandoff && topConcept) {
      const { workflow } = input.offerOpsHandoff;
      const handoffApproved = await agent.proposeAction(
        task,
        `Turn the top market-gap concept ("${topConcept}") into a "${workflow}" NixOps run?`,
        { topConcept, workflow }
      );
      if (handoffApproved) {
        const handoffTask = OpsTasks.createWorkflowRunTask({
          workflow,
          brief:
            `Use this market-gap discovery run's top-ranked concept as the product concept for ` +
            `this listing: "${topConcept}". Full discovery report for context (pain points this ` +
            `concept addresses, sourcing, competing framings):\n\n${fullReport}\n\n` +
            `This does not excuse a genuinely missing shop setting (variant naming, cost sheet, ` +
            `fulfillment type, etc.) — if the workflow's own rules say to block or escalate on ` +
            `one of those, still do; don't invent a value for it just because this is a one-shot handoff.`,
          description: `NixOps run from market-gap discovery: ${topConcept}`,
          objectiveId: task.objectiveId,
        });
        agent.emit('agent:handoff_requested', { task: handoffTask });
      }
    }
  },
};
