import {
  type AgentConfig,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { CONTENT_SKILLS } from './skills';

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
      tools: [
        'content_generate',
        'content_generate_plan',
        'content_schedule_post',
        'content_list_posts',
        'content_delete_post',
        'content_list_ideas',
        'content_analyze',
      ],
      maxTokens: 4096,
    };
    super(config, deps);
    for (const skill of CONTENT_SKILLS) {
      this.skills.registerSkill(skill);
    }
  }

  // run() is inherited from BaseAgent — see skills/ for each capability.
}
