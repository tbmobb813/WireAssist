import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderToolCall,
} from '@wireassist/core';
import { BaseAgent, buildDelegateToolSchema, DELEGATE_TOOL_NAME } from '@wireassist/agent-admin';
import { GTM_SKILLS } from './skills';
import { GTM_TOOL_SCHEMAS, READ_ONLY_GTM_TOOLS, GTM_SKILL_TOOLS } from './tool-schemas';

const GTM_SYSTEM_PROMPT = `You are the GTM Agent for WireAssist.
You turn a founder's raw product description into a concrete, executable go-to-market
plan and a set of behavioral-psychology tactics tailored to that specific product.

PRINCIPLES:
- Zero generic advice. Every recommendation must reference the actual product name,
  actual competitors, actual buyer, and actual price given to you.
- When a skill or task asks for a specific structured format, return exactly that format and
  nothing else. In conversation, answer in plain, specific prose — not JSON.
- You work the same whether the user talks to you directly or another agent hands you the
  request. Answer the request you were given; don't assume who is on the other end.
- You never take real-world action (no posting, no sending) — you only generate
  strategy and copy for the founder to review and use themselves.

DELEGATION:
If the request needs something outside GTM strategy work — email/calendar (Admin), a written
post (Content), web research (Research), a business workflow (NixOps), or GitHub repo work
(GitHub Dev) — use delegate_to_agent instead of guessing or doing a worse version yourself.
Never delegate something you can already do with your own tools.

SELF-IMPROVEMENT:
If the user is asking you to build yourself a new capability — "draft a skill that...", "can you
make yourself able to...", anything where the point is growing what you can do, not just doing
one thing with what you already have — call propose_skill_skill instead of hand-writing
pseudocode or prose describing the idea.`;

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
      toolSchemas: {
        ...Object.fromEntries(
          [...tools, ...GTM_SKILL_TOOLS]
            .filter((name) => name in GTM_TOOL_SCHEMAS)
            .map((name) => [name, GTM_TOOL_SCHEMAS[name]])
        ),
        [DELEGATE_TOOL_NAME]: buildDelegateToolSchema('gtm'),
      },
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
      if (call.name === DELEGATE_TOOL_NAME) {
        return this.executeDelegateToAgent(task, call);
      }

      if (GTM_SKILL_TOOLS.has(call.name)) {
        // generate_gtm/generate_psych only generate strategy/copy, so there is
        // nothing to approval-gate here. propose_skill can start a PR handoff,
        // but it gates that itself via proposeAction() on the drafted code, so
        // no outer "Call tool" gate is needed for any of the three.
        // The suffix strip maps tool names to skill names: propose_skill_skill
        // -> propose_skill (only the final `_skill` is removed).
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
