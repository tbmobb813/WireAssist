import Anthropic from '@anthropic-ai/sdk';
import { budgetTracker } from '@wireassist/agent-admin';

const ROUTER_MODEL = 'claude-haiku-4-5';

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'threads';

export type RouteDecision =
  | { kind: 'admin_freeform'; prompt: string }
  | { kind: 'admin_triage' }
  | { kind: 'admin_calendar'; daysAhead?: number }
  | { kind: 'content_generate'; topic: string; platform: Platform; tone?: string }
  | { kind: 'content_plan'; platforms?: Platform[]; weeksAhead?: number; postsPerWeek?: number }
  | { kind: 'content_freeform'; prompt: string }
  | { kind: 'research_topic'; query: string; depth?: 'quick' | 'deep'; offerOpsWorkflow?: string }
  | { kind: 'research_freeform'; prompt: string }
  | { kind: 'ops_freeform'; prompt: string }
  | { kind: 'ops_workflow'; workflow: string; brief: string }
  | { kind: 'gtm_freeform'; prompt: string }
  | { kind: 'gtm_redirect' }
  | { kind: 'github_freeform'; prompt: string };

export class RouterError extends Error {}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Caps prior turns fed into any single classification/answer call — bounds
// token cost and defends against an oversized/tampered client payload.
const MAX_HISTORY_MESSAGES = 20;

// Extracted as a pure function so history-threading is unit-testable
// without mocking the Anthropic SDK client routeChatMessage() constructs
// inline.
export function buildRouterMessages(
  history: ChatHistoryMessage[] | undefined,
  instruction: string
): Anthropic.MessageParam[] {
  const trimmed = (history ?? []).slice(-MAX_HISTORY_MESSAGES);
  return [
    ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: instruction },
  ];
}

const PLATFORM_ENUM = ['twitter', 'linkedin', 'instagram', 'threads'];

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'admin_freeform',
    description:
      'General question, small talk, or any request that does not clearly match another tool. Also the default when unsure.',
    input_schema: {
      type: 'object',
      properties: { prompt: { type: 'string', description: 'The instruction to answer.' } },
      required: ['prompt'],
    },
  },
  {
    name: 'admin_triage',
    description:
      'User EXPLICITLY asks to triage, review, clean up, or go through their email inbox, AND ONLY THAT — a single, cleanly-scoped ask naming "email"/"inbox" directly. Do not use this for vague productivity/status requests that might merely touch email as a side effect, and do not use this for a compound request that also asks about the calendar or anything else ("check my email and my calendar") — those route to admin_freeform instead.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'admin_calendar',
    description:
      'User EXPLICITLY asks to check, review, or look at their calendar/schedule/meetings/events, AND ONLY THAT — a single, cleanly-scoped ask naming "calendar"/"schedule"/"meetings" directly. Do not use this for vague productivity/status requests ("how are things", "what should I do today", "help me get organized") that don\'t name the calendar, and do not use this for a compound request that also asks about email or anything else ("check my email and my calendar") — those route to admin_freeform, where Admin can decide for itself whether checking the calendar is relevant.',
    input_schema: {
      type: 'object',
      properties: {
        daysAhead: { type: 'number', description: 'How many days ahead to look, default 7.' },
      },
    },
  },
  {
    name: 'content_generate',
    description:
      'User wants a single piece of social/marketing content written (a post, a tweet, an update) for one platform. Infer the platform from context even if not stated explicitly — "tweet"/"X post" means twitter, "LinkedIn post"/"update" for a professional audience means linkedin, "story"/"reel" means instagram. If genuinely no platform can be inferred, default to twitter rather than falling back to content_freeform.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'What the content should be about.' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
        tone: { type: 'string', description: 'Optional tone, e.g. "direct", "playful".' },
      },
      required: ['topic', 'platform'],
    },
  },
  {
    name: 'content_plan',
    description: 'User wants a multi-post content plan/calendar generated across platforms.',
    input_schema: {
      type: 'object',
      properties: {
        platforms: { type: 'array', items: { type: 'string', enum: PLATFORM_ENUM } },
        weeksAhead: { type: 'number' },
        postsPerWeek: { type: 'number' },
      },
    },
  },
  {
    name: 'content_freeform',
    description:
      'General question or open-ended chat about content strategy, existing posts, or ideas — not a request to generate one specific post or a full multi-post plan.',
    input_schema: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
  },
  {
    name: 'research_topic',
    description:
      'User wants web research/synthesis on a topic, market, or competitor — OR wants a specific fact that changes over time and needs a live lookup (current price, stock/availability, latest version number, today\'s exchange rate, etc.), even if it sounds like a single quick lookup question rather than "research."',
    input_schema: {
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
  {
    name: 'research_freeform',
    description:
      'Open-ended or multi-part research chat — a compound request combining a search with synthesis of prior findings, a follow-up question about earlier research, or anything not cleanly a single "research X" ask.',
    input_schema: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
  },
  {
    name: 'ops_freeform',
    description:
      'A general question about the business/ops workflows that is not a request to run a named workflow.',
    input_schema: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
  },
  {
    name: 'ops_workflow',
    description:
      'User explicitly names a specific ops workflow to run. Prefer ops_freeform unless a concrete workflow name is clearly identifiable — do not guess an invalid workflow name.',
    input_schema: {
      type: 'object',
      properties: {
        workflow: { type: 'string' },
        brief: { type: 'string', description: 'Context/brief for the workflow run.' },
      },
      required: ['workflow', 'brief'],
    },
  },
  {
    name: 'gtm_freeform',
    description:
      'General go-to-market question or discussion — positioning angles, pricing models, launch tactics, messaging — that is not a request to generate a full strategy for a specific product.',
    input_schema: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
  },
  {
    name: 'gtm_redirect',
    description:
      'User wants a full go-to-market strategy, launch plan, or psych-tactics set actually generated/built for a specific product. Use this only for a generate/build request — the full strategy needs a 16-field product form the chat cannot capture, so redirect to the wizard instead of trying to answer directly.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'github_freeform',
    description:
      'Any question or action about a real GitHub repository, issue, or pull request — reading issues/PRs/code, commenting, labeling, or opening a draft PR. Route here instead of research_freeform even though it sounds like "look something up" — this has direct, authenticated access to the actual repo data, not a generic web search.',
    input_schema: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
  },
];

const SYSTEM_PROMPT = `You are a routing classifier for WireAssist's chat interface. Given a user's
message, decide which single tool best handles it and call exactly that tool with
appropriate arguments extracted from the message.

Guidance:
- A request to actually generate/build a full GTM strategy, launch plan, or psych-tactics set for
  a specific product routes to gtm_redirect — never admin_freeform or anything else. A general
  GTM question or discussion (pricing models, positioning angles, launch tactics) that isn't asking
  to generate one for a specific product routes to gtm_freeform instead.
- Ambiguous, general-knowledge, or small-talk messages route to admin_freeform. This includes
  vague productivity/status/motivation requests that never name a specific admin tool's subject —
  "how are things looking", "what should I do today", "help me get organized", "I have a bunch of
  half-done stuff, what should I actually do" — even though Admin's own freeform tool loop may
  itself decide to check email or the calendar once it starts working. Only route directly to
  admin_triage/admin_calendar when the message itself names "email"/"inbox" or
  "calendar"/"schedule"/"meetings" as the explicit subject.
- "General-knowledge" above means a stable fact the model already knows (history, how something
  works, a well-established concept) — NOT a fact that changes over time. A question asking for
  a CURRENT price, live stock/availability, the latest version of something, today's date-sensitive
  info, or anything else that requires an actual live lookup to answer correctly is research, not
  general knowledge, even when it's phrased as one short question rather than "research X for me."
  Admin has no web-search or page-fetch tools of its own — routing this kind of question to
  admin_freeform means it either gets a stale/wrong answer from the model's own training data,
  or Admin has to notice the gap and delegate anyway, which just adds a slow, invisible extra hop.
  Route these directly to research_topic/research_freeform instead.
- Anything about a specific GitHub repo, issue, or pull request — "what are the open issues
  on X", "comment on PR #12", "what changed in the last commit" — routes to github_freeform,
  never research_freeform or admin_freeform, even if phrased like a lookup question. Only use
  research_freeform/research_topic for general web research with no direct repo access.
- Only use ops_workflow when a specific, nameable workflow is clearly being requested;
  otherwise prefer ops_freeform.
- When a research request is clearly meant to produce product listing(s) to sell (mentions
  selling, Etsy, a shop, or similar intent on top of the research ask), route to research_topic
  and set offerOpsWorkflow to 'nixlevel-listing' rather than leaving it unset.
- Only use content_generate/content_plan when the user wants NEW content written; questions
  about existing posts/ideas, or general content strategy chat, route to content_freeform.
- Compound or multi-part requests — multiple distinct asks joined by "and"/"then"/"also", or a
  request with a conditional follow-up ("check X, and if Y then do Z") — should NOT be forced
  into a single narrow tool. Route Admin-shaped compound requests (mixing inbox/calendar/general
  asks) to admin_freeform, and research-shaped compound requests (mixing search with synthesis,
  or a follow-up on earlier findings) to research_freeform, instead of arbitrarily picking just
  one of the specific asks. Only use admin_triage/admin_calendar/research_topic for a single,
  cleanly-scoped request.
- Always call exactly one tool. Never reply with plain text.`;

function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && PLATFORM_ENUM.includes(value);
}

export function buildDecision(name: string, input: unknown): RouteDecision {
  const i = (input ?? {}) as Record<string, unknown>;

  switch (name) {
    case 'admin_freeform': {
      if (typeof i.prompt !== 'string') throw new RouterError('admin_freeform missing prompt');
      return { kind: 'admin_freeform', prompt: i.prompt };
    }
    case 'admin_triage':
      return { kind: 'admin_triage' };
    case 'admin_calendar':
      return {
        kind: 'admin_calendar',
        daysAhead: typeof i.daysAhead === 'number' ? i.daysAhead : undefined,
      };
    case 'content_generate': {
      if (typeof i.topic !== 'string' || !isPlatform(i.platform)) {
        throw new RouterError('content_generate missing topic/platform');
      }
      return {
        kind: 'content_generate',
        topic: i.topic,
        platform: i.platform,
        tone: typeof i.tone === 'string' ? i.tone : undefined,
      };
    }
    case 'content_plan': {
      const platforms = Array.isArray(i.platforms) ? i.platforms.filter(isPlatform) : undefined;
      return {
        kind: 'content_plan',
        platforms: platforms && platforms.length > 0 ? platforms : undefined,
        weeksAhead: typeof i.weeksAhead === 'number' ? i.weeksAhead : undefined,
        postsPerWeek: typeof i.postsPerWeek === 'number' ? i.postsPerWeek : undefined,
      };
    }
    case 'content_freeform': {
      if (typeof i.prompt !== 'string') throw new RouterError('content_freeform missing prompt');
      return { kind: 'content_freeform', prompt: i.prompt };
    }
    case 'research_topic': {
      if (typeof i.query !== 'string') throw new RouterError('research_topic missing query');
      const depth = i.depth === 'deep' ? 'deep' : i.depth === 'quick' ? 'quick' : undefined;
      const offerOpsWorkflow =
        i.offerOpsWorkflow === 'nixlevel-listing' ? i.offerOpsWorkflow : undefined;
      return { kind: 'research_topic', query: i.query, depth, offerOpsWorkflow };
    }
    case 'research_freeform': {
      if (typeof i.prompt !== 'string') throw new RouterError('research_freeform missing prompt');
      return { kind: 'research_freeform', prompt: i.prompt };
    }
    case 'ops_freeform': {
      if (typeof i.prompt !== 'string') throw new RouterError('ops_freeform missing prompt');
      return { kind: 'ops_freeform', prompt: i.prompt };
    }
    case 'ops_workflow': {
      if (typeof i.workflow !== 'string' || typeof i.brief !== 'string') {
        throw new RouterError('ops_workflow missing workflow/brief');
      }
      return { kind: 'ops_workflow', workflow: i.workflow, brief: i.brief };
    }
    case 'gtm_freeform': {
      if (typeof i.prompt !== 'string') throw new RouterError('gtm_freeform missing prompt');
      return { kind: 'gtm_freeform', prompt: i.prompt };
    }
    case 'gtm_redirect':
      return { kind: 'gtm_redirect' };
    case 'github_freeform': {
      if (typeof i.prompt !== 'string') throw new RouterError('github_freeform missing prompt');
      return { kind: 'github_freeform', prompt: i.prompt };
    }
    default:
      throw new RouterError(`Unknown tool from classifier: ${name}`);
  }
}

export async function routeChatMessage(
  instruction: string,
  history?: ChatHistoryMessage[]
): Promise<RouteDecision> {
  budgetTracker.assertWithinBudget();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    tool_choice: { type: 'any' },
    messages: buildRouterMessages(history, instruction),
  });

  if (response.usage) {
    budgetTracker.record(
      'router',
      ROUTER_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) {
    throw new RouterError('Classifier did not call a tool');
  }

  return buildDecision(toolUse.name, toolUse.input);
}
