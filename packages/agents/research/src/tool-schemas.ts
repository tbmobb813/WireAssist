import type { ProviderToolDefinition } from '@wireassist/core';

// LLM-facing name/description/input_schema for every tool the Research
// Agent can be authorized to call. ResearchAgent's constructor filters this
// down to whatever's actually in config.tools — being listed here never
// grants authorization on its own (useTool() still checks config.tools).
export const RESEARCH_TOOL_SCHEMAS: Record<string, ProviderToolDefinition> = {
  // ── MCP (read-only) ─────────────────────────────────────────────
  brave_search: {
    name: 'brave_search',
    description: 'Search the web via Brave Search. Returns titles, URLs, and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
        count: {
          type: 'number',
          description: "Max results to return, default 20 (Brave's own default and max).",
        },
        freshness: {
          type: 'string',
          description:
            'Recency filter: "pd" (past day), "pw" (past week), "pm" (past month), "py" (past year), or a custom "YYYY-MM-DDtoYYYY-MM-DD" range. Omitted by default (pure relevance ranking, no recency filter). Set this whenever the query is time-sensitive (current pricing, latest version, recent news) — otherwise stale-but-well-ranked pages (old comparison/aggregator sites) can dominate the results.',
        },
      },
      required: ['query'],
    },
  },
  fetch_product_price: {
    name: 'fetch_product_price',
    description:
      "Fetch a specific product page URL and extract its live price from the page's own structured data (Schema.org JSON-LD, the same data retailers publish for Google's rich-snippet pricing). Use this AFTER brave_search/research_topic_skill has identified a specific, promising retailer product URL (e.g. an Amazon, Newegg, or Best Buy product page) — search result snippets do not contain live prices, only text crawled at some point in the past, so this is the only way to get an actually-current number. Returns found:false with a note if the page has no structured price data (e.g. price is only rendered client-side via JS, which this cannot see) — treat that as a real \"couldn't confirm,\" not a reason to guess.",
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The specific product page URL to fetch.' },
      },
      required: ['url'],
    },
  },
  // ── Skills, exposed as composable tools (dispatched via invokeSkill(),
  // not useTool() — see ResearchAgent.executeToolCall()). These run genuine
  // multi-step work internally (search -> synthesize -> propose to
  // remember) and self-gate any mutation with their own proposeAction()
  // calls, so they execute immediately at this outer level rather than
  // being approval-gated a second time. Named with a `_skill` suffix to
  // stay visually distinct from raw MCP tool names above.
  research_topic_skill: {
    name: 'research_topic_skill',
    description:
      'Run the full research skill on a topic: search the web, synthesize the findings into a summary, and propose storing them to memory. Use this instead of brave_search when the user wants a topic actually researched, not just searched.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to research.' },
        resultCount: {
          type: 'number',
          description: "Max search results to consider, default 20 (Brave's own default and max).",
        },
        freshness: {
          type: 'string',
          description:
            'Recency filter: "pd"/"pw"/"pm"/"py" (past day/week/month/year) or a custom "YYYY-MM-DDtoYYYY-MM-DD" range. Set this whenever the query is time-sensitive (current pricing, latest version, recent news) — omitted by default, which lets stale-but-well-ranked pages dominate results for that kind of query.',
        },
      },
      required: ['query'],
    },
  },
  synthesize_findings_skill: {
    name: 'synthesize_findings_skill',
    description:
      'Synthesize all previously-stored research findings on a topic from memory, and propose storing the synthesis. Use this when the user wants existing findings pulled together, not a new web search.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The topic to synthesize prior findings on.' },
      },
      required: ['topic'],
    },
  },
  // The one registered SkillChain (research_topic -> synthesize_findings,
  // see skills/index.ts's RESEARCH_AND_SYNTHESIZE_CHAIN), exposed as a
  // single composable tool — invokeSkill() runs both steps in sequence and
  // surfaces the final synthesis as the result.
  research_and_synthesize_skill: {
    name: 'research_and_synthesize_skill',
    description:
      'Research a topic AND synthesize it together with any prior findings on it, in one pass. Use this instead of research_topic_skill when the user explicitly wants both a fresh search and a synthesis with existing knowledge, not just one or the other.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to research and synthesize.' },
        resultCount: {
          type: 'number',
          description: "Max search results to consider, default 20 (Brave's own default and max).",
        },
        freshness: {
          type: 'string',
          description:
            'Recency filter: "pd"/"pw"/"pm"/"py" (past day/week/month/year) or a custom "YYYY-MM-DDtoYYYY-MM-DD" range. Set this whenever the query is time-sensitive (current pricing, latest version, recent news).',
        },
      },
      required: ['query'],
    },
  },
  propose_skill_skill: {
    name: 'propose_skill_skill',
    description:
      'Draft a brand-new Research skill (real TypeScript) for a capability the user describes, and — once they approve the drafted code — send it to the GitHub Dev Agent to open as a draft PR for review. The drafted code is never wired into the running system by this tool; that stays a separate, manual step after the PR is reviewed and merged. Use this when the user is asking you to build yourself a new capability, not asking you to just do something with your existing tools.',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: "The capability being requested, in the user's own words.",
        },
      },
      required: ['request'],
    },
  },
};

// MCP tool names that only ever read data — safe to execute immediately in
// the chat tool loop without going through the approval queue.
export const READ_ONLY_RESEARCH_TOOLS = new Set<string>(['brave_search', 'fetch_product_price']);

// Skill-tool names dispatched via invokeSkill() rather than useTool() — see
// ResearchAgent.executeToolCall(). Kept separate from
// READ_ONLY_RESEARCH_TOOLS since these are never valid useTool()/MCP calls.
export const RESEARCH_SKILL_TOOLS = new Set<string>([
  'research_topic_skill',
  'synthesize_findings_skill',
  'research_and_synthesize_skill',
  'propose_skill_skill',
]);
