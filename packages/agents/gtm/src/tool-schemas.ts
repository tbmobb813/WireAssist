import type { ProviderToolDefinition } from '@wireassist/core';

// LLM-facing name/description/input_schema for every tool the GTM chat loop
// can call. GtmAgent has no raw MCP tools of its own (no Gmail/Sheets/search
// equivalent) — everything here is a skill-tool, dispatched via
// invokeSkill() rather than useTool()/MCP (see GtmAgent.executeToolCall()).
// Being listed here never grants authorization on its own.
const PRODUCT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Product name.' },
    cat: { type: 'string', description: 'Product category.' },
    problem: { type: 'string', description: 'The problem this product solves.' },
    benefit: { type: 'string', description: 'The core benefit to the buyer.' },
    diff: { type: 'string', description: 'What differentiates it from alternatives.' },
    buyer: { type: 'string', description: 'Who the actual buyer is.' },
    segment: { type: 'string', description: 'The target market segment.' },
    comp: { type: 'string', description: 'Real, named competitors.' },
    channels: { type: 'string', description: 'Channels already tried or considered.' },
    pain: { type: 'string', description: "The buyer's specific pain point." },
    price: { type: 'string', description: 'Actual price or pricing model.' },
    model: { type: 'string', description: 'Revenue model (subscription, one-time, etc).' },
    free: { type: 'string', description: 'Free tier / trial details, if any.' },
    goal: { type: 'string', description: 'The founder’s current goal.' },
    current: { type: 'string', description: 'What GTM efforts exist today, if any.' },
    budget: { type: 'string', description: 'Marketing budget available.' },
  },
  required: ['name'],
};

export const GTM_TOOL_SCHEMAS: Record<string, ProviderToolDefinition> = {
  // ── Skills, exposed as composable tools (dispatched via invokeSkill(),
  // not useTool() — see GtmAgent.executeToolCall()). Neither skill takes a
  // real-world action (GTM never posts/sends anything — see its system
  // prompt), so both execute immediately at this outer level rather than
  // being approval-gated. Named with a `_skill` suffix to stay visually
  // distinct from raw MCP tool names.
  generate_gtm_skill: {
    name: 'generate_gtm_skill',
    description:
      'Generate a full go-to-market strategy (positioning, organic/paid channels, launch timeline, KPIs) for a specific product. Requires real product details — never invent them; ask the user for anything missing.',
    inputSchema: {
      type: 'object',
      properties: { product: PRODUCT_SCHEMA },
      required: ['product'],
    },
  },
  generate_psych_skill: {
    name: 'generate_psych_skill',
    description:
      'Generate 9 behavioral-psychology marketing tactics tailored to a specific product. Requires real product details — never invent them; ask the user for anything missing.',
    inputSchema: {
      type: 'object',
      properties: { product: PRODUCT_SCHEMA },
      required: ['product'],
    },
  },
  propose_skill_skill: {
    name: 'propose_skill_skill',
    description:
      'Draft a brand-new GTM skill (real TypeScript) for a capability the user describes, and — once they approve the drafted code — send it to the GitHub Dev Agent to open as a draft PR for review. The drafted code is never wired into the running system by this tool; that stays a separate, manual step after the PR is reviewed and merged. Use this when the user is asking you to build yourself a new capability, not asking you to just do something with your existing tools.',
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

// Tool names that only ever read data — safe to execute immediately in the
// chat tool loop without going through the approval queue. GTM has no raw
// MCP tools today, so this is empty; kept for parity with the other four
// agents so a future raw tool (e.g. a competitor-pricing lookup) drops in
// without another architecture pass.
export const READ_ONLY_GTM_TOOLS = new Set<string>();

// Skill-tool names dispatched via invokeSkill() rather than useTool() — see
// GtmAgent.executeToolCall(). Kept separate from READ_ONLY_GTM_TOOLS since
// these are never valid useTool()/MCP calls.
export const GTM_SKILL_TOOLS = new Set<string>([
  'generate_gtm_skill',
  'generate_psych_skill',
  'propose_skill_skill',
]);
