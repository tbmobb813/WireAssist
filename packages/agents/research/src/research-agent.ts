import { BaseAgent, buildDelegateToolSchema, DELEGATE_TOOL_NAME } from '@wireassist/agent-admin';
import type {
  AgentConfig,
  AgentTask,
  IApprovalQueue,
  MemoryStore,
  MCPClient,
  EventBus,
  ProviderToolCall,
} from '@wireassist/core';
import { RESEARCH_SKILLS, RESEARCH_AND_SYNTHESIZE_CHAIN } from './skills';
import {
  RESEARCH_TOOL_SCHEMAS,
  READ_ONLY_RESEARCH_TOOLS,
  RESEARCH_SKILL_TOOLS,
} from './tool-schemas';

const SYSTEM_PROMPT = `You are a Research Agent for WireAssist. Your job is to find, synthesize, and present information clearly and accurately — and to be honest about how solid the findings actually are.

Principles:
- Every claim in your summary must trace back to a specific source you were given —
  never state something as fact because it "sounds right" or matches general knowledge.
  If a source doesn't actually support a claim, don't make the claim.
- Flag disagreement explicitly. If two sources conflict on a factual point, say so by
  name ("Source A says X, Source B says Y") — don't quietly pick one and present it as
  settled.
- Distinguish single-source claims from corroborated ones. A claim backed by one page is
  weaker than one multiple independent sources agree on — say which is which when it
  matters to the conclusion.
- If the search results are thin, outdated, or don't actually answer the query, say that
  plainly instead of stretching them into a confident-sounding summary. "I couldn't find
  reliable information on X" is a valid and useful finding.
- Be direct — no filler, no padding.
- Structure findings as: Key Takeaways → Details → Sources, and always cite source URLs.

DELEGATION:
If the request needs something outside research work — email/calendar (Admin), a written post
(Content), a business workflow (NixOps), a go-to-market strategy (GTM), or GitHub repo work
(GitHub Dev) — use delegate_to_agent instead of guessing or doing a worse version yourself.
Never delegate something you can already do with your own tools.

SELF-IMPROVEMENT:
If the user is asking you to build yourself a new capability — "draft a skill that...", "can you
make yourself able to...", anything where the point is growing what you can do, not just doing
one thing with what you already have — call propose_skill_skill instead of hand-writing
pseudocode or prose describing the idea.`;

const RESEARCH_TOOLS = ['brave_search', 'fetch_product_price'];

const DEFAULT_CONFIG: AgentConfig = {
  role: 'research',
  name: 'Research Agent',
  systemPrompt: SYSTEM_PROMPT,
  tools: RESEARCH_TOOLS,
  // Skill-tools (research_topic_skill, synthesize_findings_skill) are added
  // to the model-facing schema list here but deliberately NOT to `tools`
  // above — they're dispatched via invokeSkill(), never useTool()/MCP, so
  // they have no business in the MCP authorization list.
  toolSchemas: {
    ...Object.fromEntries(
      [...RESEARCH_TOOLS, ...RESEARCH_SKILL_TOOLS]
        .filter((name) => name in RESEARCH_TOOL_SCHEMAS)
        .map((name) => [name, RESEARCH_TOOL_SCHEMAS[name]])
    ),
    [DELEGATE_TOOL_NAME]: buildDelegateToolSchema('research'),
  },
  maxTokens: 2048,
};

export class ResearchAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    super(DEFAULT_CONFIG, deps);
    for (const skill of RESEARCH_SKILLS) {
      this.skills.registerSkill(skill);
    }
    this.skills.registerChain(RESEARCH_AND_SYNTHESIZE_CHAIN);
  }

  // run() is inherited from BaseAgent — see skills/ for each capability.

  // ─── TOOL-CALLING LOOP HOOKS (used by BaseAgent.runToolLoop) ──────

  protected isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_RESEARCH_TOOLS.has(toolName);
  }

  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      if (call.name === DELEGATE_TOOL_NAME) {
        return this.executeDelegateToAgent(task, call);
      }

      if (RESEARCH_SKILL_TOOLS.has(call.name)) {
        // Skill-tools self-gate their own mutations via internal
        // proposeAction() calls — dispatch immediately rather than
        // approval-gating a second time. offerContentDraft is never
        // exposed on research_topic_skill's schema, so the model can't
        // trigger a Content handoff mid-plan.
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
