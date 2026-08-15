import {
  type AgentConfig,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { GTM_SKILLS } from './skills';

const GTM_SYSTEM_PROMPT = `You are the GTM Agent for WireAssist.
You turn a founder's raw product description into a concrete, executable go-to-market
plan and a set of behavioral-psychology tactics tailored to that specific product.

PRINCIPLES:
- Zero generic advice. Every recommendation must reference the actual product name,
  actual competitors, actual buyer, and actual price given to you.
- Output only what was asked for — valid JSON, no markdown fences, no preamble.
- You never take real-world action (no posting, no sending) — you only generate
  strategy and copy for the founder to review and use themselves.`;

export class GtmAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    const config: AgentConfig = {
      role: 'gtm',
      name: 'GTM Agent',
      systemPrompt: GTM_SYSTEM_PROMPT,
      tools: [],
      maxTokens: 4096,
    };
    super(config, deps);
    for (const skill of GTM_SKILLS) {
      this.skills.registerSkill(skill);
    }
  }

  // run() is inherited from BaseAgent — see skills/ for each capability.
}
