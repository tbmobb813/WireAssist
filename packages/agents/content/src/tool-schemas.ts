import type { ProviderToolDefinition } from '@wireassist/core';

const PLATFORM_ENUM = ['twitter', 'linkedin', 'instagram', 'threads'];

// LLM-facing name/description/input_schema for every tool the Content Agent
// can be authorized to call. ContentAgent's constructor filters this down to
// whatever's actually in config.tools — being listed here never grants
// authorization on its own (useTool() still checks config.tools).
export const CONTENT_TOOL_SCHEMAS: Record<string, ProviderToolDefinition> = {
  // ── Read-only / no persisted side effect ────────────────────────
  content_generate: {
    name: 'content_generate',
    description:
      'Write a single social/marketing post for one platform. Does not save or schedule it.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'What the post should be about.' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
        tone: { type: 'string', description: 'Optional tone, e.g. "direct", "playful".' },
        context: { type: 'string', description: 'Optional business context to ground the post.' },
      },
      required: ['topic', 'platform'],
    },
  },
  content_list_posts: {
    name: 'content_list_posts',
    description:
      'List scheduled/posted content, optionally filtered by status, platform, or window.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'e.g. "scheduled", "posted".' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
        daysAhead: { type: 'number', description: 'Only include posts within this many days.' },
      },
    },
  },
  content_list_ideas: {
    name: 'content_list_ideas',
    description: 'List saved content ideas, optionally filtered by status.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string' } },
    },
  },
  content_analyze: {
    name: 'content_analyze',
    description: 'Score an existing piece of content and suggest a specific improvement.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
      },
      required: ['content', 'platform'],
    },
  },
  // ── Mutating — always approval-gated ────────────────────────────
  content_generate_plan: {
    name: 'content_generate_plan',
    description:
      'Generate and save a multi-post content plan across platforms. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        businessContext: { type: 'string' },
        platforms: { type: 'array', items: { type: 'string', enum: PLATFORM_ENUM } },
        weeksAhead: { type: 'number' },
        postsPerWeek: { type: 'number' },
      },
      required: ['businessContext', 'platforms'],
    },
  },
  content_schedule_post: {
    name: 'content_schedule_post',
    description: 'Schedule a post for a specific time. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        platform: { type: 'string', enum: PLATFORM_ENUM },
        scheduledAt: { type: 'string', description: 'ISO 8601 datetime.' },
        tags: { type: 'array', items: { type: 'string' } },
        campaignId: { type: 'string' },
      },
      required: ['content', 'platform', 'scheduledAt'],
    },
  },
  content_delete_post: {
    name: 'content_delete_post',
    description: 'Delete a scheduled or posted item. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: { postId: { type: 'string' } },
      required: ['postId'],
    },
  },
  content_generate_plan_from_timeline: {
    name: 'content_generate_plan_from_timeline',
    description:
      'Turn a GTM launch timeline into a dated content calendar under a new campaign — one idea per timeline week. Requires human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        productName: { type: 'string' },
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week: { type: 'string' },
              focus: { type: 'string' },
              tasks: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        platforms: { type: 'array', items: { type: 'string', enum: PLATFORM_ENUM } },
        campaignName: { type: 'string' },
      },
      required: ['productName', 'timeline', 'platforms'],
    },
  },
  // ── Bookkeeping — no persisted side effect beyond local status ──
  content_create_campaign: {
    name: 'content_create_campaign',
    description: 'Create a campaign to group related content ideas and posts under.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  content_list_campaigns: {
    name: 'content_list_campaigns',
    description: 'List all campaigns.',
    inputSchema: { type: 'object', properties: {} },
  },
  content_mark_published: {
    name: 'content_mark_published',
    description:
      'Mark a scheduled post as published — for self-reporting a post you already published manually, not for triggering an actual publish action.',
    inputSchema: {
      type: 'object',
      properties: { postId: { type: 'string' } },
      required: ['postId'],
    },
  },
};

// Tool names safe to execute immediately in the chat tool loop without going
// through the approval queue — either because they only read data / produce
// ephemeral (non-persisted) output, or because they're low-risk bookkeeping
// where the user is self-reporting something they already did (creating a
// grouping label, confirming a manual post) rather than asking the agent to
// take an external action. Everything else in CONTENT_TOOL_SCHEMAS proposes
// or schedules real content and must be approved first.
export const READ_ONLY_CONTENT_TOOLS = new Set<string>([
  'content_generate',
  'content_list_posts',
  'content_list_ideas',
  'content_analyze',
  'content_list_campaigns',
  // Bookkeeping only — the user is self-reporting something they already
  // did (created a grouping label, published a post themselves), not asking
  // the agent to take an external action.
  'content_create_campaign',
  'content_mark_published',
]);
