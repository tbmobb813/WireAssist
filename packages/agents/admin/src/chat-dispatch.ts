import type {
  AgentRole,
  DocumentAttachment,
  ImageAttachment,
  ProviderMessage,
  ProviderToolDefinition,
} from '@wireassist/core';
import type { Platform } from '@wireassist/trendpost-mcp';

// Admin-only chat dispatch — deliberately separate from delegate.ts's
// delegate_to_agent. That tool is unconditionally approval-gated
// (BaseAgent.executeDelegateToAgent) and other things already depend on
// that exact behavior (e.g. the Research -> Content handoff pilot); it
// stays untouched. These tools exist for the mechanical, well-specified
// requests that today's chat-router.ts dispatched with zero approval
// clicks — "write a tweet about X", "run the nixlevel-listing workflow" —
// where a human-approval prompt on every routine chat message would be a
// real UX regression, not added safety.

export interface DispatchCtx {
  history?: ProviderMessage[];
  objectiveId?: string;
  images?: ImageAttachment[];
  documents?: DocumentAttachment[];
}

export interface ChatDispatchResult {
  taskId: string;
  agentRole: AgentRole;
  // Fed back into Admin's tool loop as the tool_result content — keep this
  // short and conversational, since Admin's own next turn is usually just
  // acknowledging it to the user ("Sure, drafting that now...").
  summary: string;
}

// Implemented in packages/command-center/src/api/server.ts (buildChatDispatch),
// which already safely depends on every agent package's task factories and
// queue functions — packages/agents/admin cannot import those directly
// without creating a circular workspace dependency (content/research/ops/
// gtm/github all depend on agent-admin for BaseAgent). AdminAgent only ever
// sees this interface, injected via its constructor, same shape as its
// existing approval/memory/mcp/events deps.
export interface ChatDispatch {
  contentPost(
    input: { topic: string; platform: Platform; tone?: string },
    ctx: DispatchCtx
  ): Promise<ChatDispatchResult>;
  contentPlan(
    input: { platforms?: Platform[]; weeksAhead?: number; postsPerWeek?: number },
    ctx: DispatchCtx
  ): Promise<ChatDispatchResult>;
  contentCampaign(
    input: { platforms?: Platform[]; weeksAhead?: number; postsPerWeek?: number },
    ctx: DispatchCtx
  ): Promise<ChatDispatchResult>;
  contentFreeform(input: { prompt: string }, ctx: DispatchCtx): Promise<ChatDispatchResult>;
  researchTopic(
    input: { query: string; depth?: 'quick' | 'deep'; offerOpsWorkflow?: string },
    ctx: DispatchCtx
  ): Promise<ChatDispatchResult>;
  researchFreeform(input: { prompt: string }, ctx: DispatchCtx): Promise<ChatDispatchResult>;
  opsWorkflow(
    input: { workflow: string; brief: string },
    ctx: DispatchCtx
  ): Promise<ChatDispatchResult>;
  opsFreeform(input: { prompt: string }, ctx: DispatchCtx): Promise<ChatDispatchResult>;
  gtmFreeform(input: { prompt: string }, ctx: DispatchCtx): Promise<ChatDispatchResult>;
  githubFreeform(input: { prompt: string }, ctx: DispatchCtx): Promise<ChatDispatchResult>;
  // No task queued at all — chat-router.ts's gtm_redirect never created one
  // either (full GTM strategies need a 16-field form the chat can't
  // capture). Synchronous, not a ChatDispatchResult.
  redirectToGtmWizard(): { redirect: string; message: string };
}

export const DISPATCH_TOOL_NAMES = new Set<string>([
  'dispatch_content_post',
  'dispatch_content_plan',
  'dispatch_content_campaign',
  'dispatch_content_freeform',
  'dispatch_research_topic',
  'dispatch_research_freeform',
  'dispatch_ops_workflow',
  'dispatch_ops_freeform',
  'dispatch_gtm_freeform',
  'redirect_to_gtm_wizard',
  'dispatch_github_freeform',
]);

const PLATFORM_ENUM = ['twitter', 'linkedin', 'instagram', 'threads'];

// Descriptions copied near-verbatim from chat-router.ts's TOOLS array —
// tuned through several real bug-fix sessions (the live-price/stock/
// version wording on research_topic, the GitHub-vs-research
// disambiguation, the GTM-wizard "16-field form" framing). Rewritten only
// where the framing changes from "pick this tool" (classifier) to "call
// this tool yourself" (Admin's own reasoning).
export function buildChatDispatchToolSchemas(): Record<string, ProviderToolDefinition> {
  return {
    dispatch_content_post: {
      name: 'dispatch_content_post',
      description:
        'Hand off a single piece of social/marketing content (a post, a tweet, an update) for one ' +
        'platform to the Content agent to actually write. Infer the platform from context even if ' +
        'not stated explicitly — "tweet"/"X post" means twitter, "LinkedIn post"/"update" for a ' +
        'professional audience means linkedin, "story"/"reel" means instagram. If genuinely no ' +
        'platform can be inferred, default to twitter rather than falling back to ' +
        'dispatch_content_freeform. Starts immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'What the content should be about.' },
          platform: { type: 'string', enum: PLATFORM_ENUM },
          tone: { type: 'string', description: 'Optional tone, e.g. "direct", "playful".' },
        },
        required: ['topic', 'platform'],
      },
    },
    dispatch_content_plan: {
      name: 'dispatch_content_plan',
      description:
        'Hand off a multi-post content IDEA list/calendar across platforms to the Content agent — ' +
        'topics, angles, and suggested dates, not drafted or scheduled posts. Use when the user ' +
        'wants ideas/a calendar to review, not finished content ready to go out (use ' +
        'dispatch_content_campaign for that instead). Starts immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          platforms: { type: 'array', items: { type: 'string', enum: PLATFORM_ENUM } },
          weeksAhead: { type: 'number' },
          postsPerWeek: { type: 'number' },
        },
      },
    },
    dispatch_content_campaign: {
      name: 'dispatch_content_campaign',
      description:
        'Hand off a full content campaign to the Content agent — generates ideas, drafts every ' +
        'post, self-scores each one, retries a weak draft once with specific feedback, then asks ' +
        'for ONE batch approval to schedule everything that passed. Use for "plan AND schedule"/' +
        '"a week of posts ready to go" asks, not just a list of ideas (use dispatch_content_plan ' +
        'for that). Starts immediately, no approval needed until the single scheduling approval at ' +
        'the end.',
      inputSchema: {
        type: 'object',
        properties: {
          platforms: { type: 'array', items: { type: 'string', enum: PLATFORM_ENUM } },
          weeksAhead: { type: 'number' },
          postsPerWeek: { type: 'number' },
        },
      },
    },
    dispatch_content_freeform: {
      name: 'dispatch_content_freeform',
      description:
        'Hand off a general question or open-ended chat about content strategy, existing posts, or ' +
        'ideas to the Content agent — not a request to generate one specific post or a full ' +
        'multi-post plan (use dispatch_content_post/dispatch_content_plan for those instead). ' +
        'Starts immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Self-contained instruction for Content.' },
        },
        required: ['prompt'],
      },
    },
    dispatch_research_topic: {
      name: 'dispatch_research_topic',
      description:
        'Hand off web research/synthesis on a topic, market, or competitor to the Research agent — ' +
        'OR use this for a specific fact that changes over time and needs a live lookup (current ' +
        "price, stock/availability, latest version number, today's exchange rate, etc.), even if it " +
        'sounds like a single quick lookup question rather than "research." You have no web-search ' +
        'or page-fetch tools of your own — answering a live-lookup question yourself from training ' +
        'data risks a stale or wrong answer. Starts immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to research.' },
          depth: { type: 'string', enum: ['quick', 'deep'] },
          offerOpsWorkflow: {
            type: 'string',
            enum: ['nixlevel-listing'],
            description:
              'Set this ONLY when the research is clearly in service of building product ' +
              'listing(s) to sell (e.g. "research trending back-to-school items to sell on Etsy") ' +
              '— triggers an automatic (still approval-gated) handoff to NixOps after the research ' +
              'completes. Leave unset for general/informational research with no clear intent to ' +
              'turn it into a listing.',
          },
        },
        required: ['query'],
      },
    },
    dispatch_research_freeform: {
      name: 'dispatch_research_freeform',
      description:
        'Hand off open-ended or multi-part research chat to the Research agent — a compound request ' +
        'combining a search with synthesis of prior findings, a follow-up question about earlier ' +
        'research, or anything not cleanly a single "research X" ask (use dispatch_research_topic ' +
        'for that instead). Starts immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Self-contained instruction for Research.' },
        },
        required: ['prompt'],
      },
    },
    dispatch_ops_workflow: {
      name: 'dispatch_ops_workflow',
      description:
        'Run a specific, nameable ops workflow via the NixOps agent. Only use this when a concrete ' +
        'workflow name is clearly identifiable — do not guess an invalid workflow name; prefer ' +
        'dispatch_ops_freeform otherwise. Starts immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          workflow: { type: 'string' },
          brief: { type: 'string', description: 'Context/brief for the workflow run.' },
        },
        required: ['workflow', 'brief'],
      },
    },
    dispatch_ops_freeform: {
      name: 'dispatch_ops_freeform',
      description:
        'Hand off a general question about the business/ops workflows to the NixOps agent — not a ' +
        'request to run a named workflow (use dispatch_ops_workflow for that instead). Starts ' +
        'immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Self-contained instruction for NixOps.' },
        },
        required: ['prompt'],
      },
    },
    dispatch_gtm_freeform: {
      name: 'dispatch_gtm_freeform',
      description:
        'Hand off a general go-to-market question or discussion — positioning angles, pricing ' +
        'models, launch tactics, messaging — to the GTM agent. Not for a request to generate a full ' +
        'strategy for a specific product (use redirect_to_gtm_wizard for that instead). Starts ' +
        'immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Self-contained instruction for GTM.' },
        },
        required: ['prompt'],
      },
    },
    redirect_to_gtm_wizard: {
      name: 'redirect_to_gtm_wizard',
      description:
        'Use when the user wants a full go-to-market strategy, launch plan, or psych-tactics set ' +
        'actually generated/built for a specific product. The full strategy needs a 16-field ' +
        "product form chat can't capture, so this points them at the GTM wizard instead of trying " +
        'to answer directly or dispatching to GTM freeform. No task is queued.',
      inputSchema: { type: 'object', properties: {} },
    },
    dispatch_github_freeform: {
      name: 'dispatch_github_freeform',
      description:
        'Hand off any question or action about a real GitHub repository, issue, or pull request — ' +
        'reading issues/PRs/code, commenting, labeling, or opening a draft PR — to the GitHub Dev ' +
        'agent. Use this instead of dispatch_research_freeform/dispatch_research_topic even though ' +
        'it sounds like "look something up" — GitHub Dev has direct, authenticated access to the ' +
        'actual repo data, not a generic web search. Starts immediately, no approval needed.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Self-contained instruction for GitHub Dev.' },
        },
        required: ['prompt'],
      },
    },
  };
}
