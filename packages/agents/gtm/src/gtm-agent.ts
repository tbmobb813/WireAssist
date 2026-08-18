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
import { GTM_SKILLS } from './skills';
import { GTM_TOOL_SCHEMAS, READ_ONLY_GTM_TOOLS, GTM_SKILL_TOOLS } from './tool-schemas';

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
    const tools: string[] = [];
    const config: AgentConfig = {
      role: 'gtm',
      name: 'GTM Agent',
      systemPrompt: GTM_SYSTEM_PROMPT,
      tools,
      // GTM has no raw MCP tools — every entry here is a skill-tool
      // (dispatched via invokeSkill(), never useTool()/MCP), so they're
      // deliberately not added to `tools` above.
      toolSchemas: Object.fromEntries(
        [...tools, ...GTM_SKILL_TOOLS]
          .filter((name) => name in GTM_TOOL_SCHEMAS)
          .map((name) => [name, GTM_TOOL_SCHEMAS[name]])
      ),
      maxTokens: 4096,
    };
    super(config, deps);
    for (const skill of GTM_SKILLS) {
      this.skills.registerSkill(skill);
    }
  }

  // run() is inherited from BaseAgent — see skills/ for each capability.

  // ─── TOOL-CALLING LOOP HOOKS (used by BaseAgent.runToolLoop) ──────

  protected isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_GTM_TOOLS.has(toolName);
  }

  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      if (GTM_SKILL_TOOLS.has(call.name)) {
        // Both skill-tools only generate strategy/copy — GTM never takes a
        // real-world action (see system prompt) — so dispatch immediately
        // rather than approval-gating a call that has nothing to approve.
        const skillName = call.name.replace(/_skill$/, '');
        return { result: await this.invokeSkill(task, skillName, call.input), isError: false };
      }

      if (this.isReadOnlyTool(call.name)) {
        return { result: await this.useTool(call.name, call.input), isError: false };
      }

      const approved = await this.proposeAction(task, `Call tool "${call.name}"`, call.input);
      if (!approved) {
        return { result: 'User declined this action.', isError: true };
      }
      return { result: await this.useTool(call.name, call.input), isError: false };
    } catch (error) {
      return { result: error instanceof Error ? error.message : String(error), isError: true };
    }
  }
}
