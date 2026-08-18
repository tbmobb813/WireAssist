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
      },
      required: ['query'],
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
      },
      required: ['query'],
    },
  },
};

// MCP tool names that only ever read data — safe to execute immediately in
// the chat tool loop without going through the approval queue.
export const READ_ONLY_RESEARCH_TOOLS = new Set<string>(['brave_search']);

// Skill-tool names dispatched via invokeSkill() rather than useTool() — see
// ResearchAgent.executeToolCall(). Kept separate from
// READ_ONLY_RESEARCH_TOOLS since these are never valid useTool()/MCP calls.
export const RESEARCH_SKILL_TOOLS = new Set<string>([
  'research_topic_skill',
  'synthesize_findings_skill',
  'research_and_synthesize_skill',
]);
