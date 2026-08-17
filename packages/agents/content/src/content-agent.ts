import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderToolCall,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { CONTENT_SKILLS } from './skills';
import { CONTENT_TOOL_SCHEMAS, READ_ONLY_CONTENT_TOOLS } from './tool-schemas';

const CONTENT_SYSTEM_PROMPT = `You are the Content Agent for WireAssist.
You help solo operators build a consistent, authentic content presence.

PRINCIPLES:
- Quality over quantity. One great post beats five mediocre ones.
- You understand the operator's business deeply before generating content.
- You NEVER post without explicit human approval.
- You learn what content performs well and apply it to future work.
- You coordinate with the Admin Agent — if there's a product launch or event, you create content for it.

YOUR CAPABILITIES:
- Generate single posts for any platform
- Create weekly content plans
- Analyze and improve existing content
- Schedule approved posts
- Track what's been posted and what's coming up`;

const CONTENT_TOOLS = [
  'content_generate',
  'content_generate_plan',
  'content_schedule_post',
  'content_list_posts',
  'content_delete_post',
  'content_list_ideas',
  'content_analyze',
  'content_generate_plan_from_timeline',
  'content_create_campaign',
  'content_list_campaigns',
  'content_mark_published',
];

export class ContentAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    const config: AgentConfig = {
      role: 'content',
      name: 'Content Agent',
      systemPrompt: CONTENT_SYSTEM_PROMPT,
      tools: CONTENT_TOOLS,
      toolSchemas: Object.fromEntries(
        CONTENT_TOOLS.filter((name) => name in CONTENT_TOOL_SCHEMAS).map((name) => [
          name,
          CONTENT_TOOL_SCHEMAS[name],
        ])
      ),
      maxTokens: 4096,
    };
    super(config, deps);
    for (const skill of CONTENT_SKILLS) {
      this.skills.registerSkill(skill);
    }
  }

  // run() is inherited from BaseAgent — see skills/ for each capability.

  // ─── TOOL-CALLING LOOP HOOKS (used by BaseAgent.runToolLoop) ──────

  protected isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_CONTENT_TOOLS.has(toolName);
  }

  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      if (this.isReadOnlyTool(call.name)) {
        return { result: await this.useTool(call.name, call.input), isError: false };
      }

      const approved = await this.proposeAction(task, describeToolCall(call), call.input);
      if (!approved) {
        return { result: 'User declined this action.', isError: true };
      }
      return { result: await this.useTool(call.name, call.input), isError: false };
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isError: true };
    }
  }
}

// Human-readable approval-prompt labels for model-initiated tool calls in
// the chat loop.
function describeToolCall(call: ProviderToolCall): string {
  const input = call.input;
  switch (call.name) {
    case 'content_generate_plan':
      return `Generate content plan (${Array.isArray(input.platforms) ? input.platforms.join(', ') : 'multiple platforms'})`;
    case 'content_schedule_post':
      return `Schedule ${input.platform} post for ${input.scheduledAt}`;
    case 'content_delete_post':
      return `Delete post ${input.postId}`;
    case 'content_generate_plan_from_timeline':
      return `Generate content calendar from launch timeline for "${input.productName}"`;
    default:
      return `Run tool "${call.name}"`;
  }
}
