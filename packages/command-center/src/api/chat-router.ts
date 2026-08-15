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
  | { kind: 'research_topic'; query: string; depth?: 'quick' | 'deep' }
  | { kind: 'ops_freeform'; prompt: string }
  | { kind: 'ops_workflow'; workflow: string; brief: string }
  | { kind: 'gtm_redirect' };

export class RouterError extends Error {}

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
    description: 'User wants their email inbox triaged/reviewed.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'admin_calendar',
    description: 'User wants their calendar reviewed/checked for upcoming events.',
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
      'User wants a single piece of social/marketing content written (a post, a tweet, an update) for one platform.',
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
    description: 'User wants web research/synthesis on a topic, market, or competitor.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to research.' },
        depth: { type: 'string', enum: ['quick', 'deep'] },
      },
      required: ['query'],
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
    name: 'gtm_redirect',
    description:
      'User wants a go-to-market strategy, positioning, pricing strategy, or launch plan for a product. Always use this for GTM-shaped requests — never try to answer them directly, the full strategy needs a 16-field product form the chat cannot capture.',
    input_schema: { type: 'object', properties: {} },
  },
];

const SYSTEM_PROMPT = `You are a routing classifier for WireAssist's chat interface. Given a user's
message, decide which single tool best handles it and call exactly that tool with
appropriate arguments extracted from the message.

Guidance:
- GTM strategy / positioning / pricing strategy / go-to-market / launch plan requests
  always route to gtm_redirect, never admin_freeform or anything else.
- Ambiguous, general-knowledge, or small-talk messages route to admin_freeform.
- Only use ops_workflow when a specific, nameable workflow is clearly being requested;
  otherwise prefer ops_freeform.
- Only use content_generate/content_plan when the user wants NEW content written; questions
  about existing posts/ideas, or general content strategy chat, route to content_freeform.
- Always call exactly one tool. Never reply with plain text.`;

function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && PLATFORM_ENUM.includes(value);
}

function buildDecision(name: string, input: unknown): RouteDecision {
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
      return { kind: 'research_topic', query: i.query, depth };
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
    case 'gtm_redirect':
      return { kind: 'gtm_redirect' };
    default:
      throw new RouterError(`Unknown tool from classifier: ${name}`);
  }
}

export async function routeChatMessage(instruction: string): Promise<RouteDecision> {
  budgetTracker.assertWithinBudget();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: instruction }],
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
