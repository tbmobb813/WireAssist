import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderMessage,
  type ProviderToolCall,
} from '@wireassist/core';
import { BaseAgent, buildDelegateToolSchema, DELEGATE_TOOL_NAME } from '@wireassist/agent-admin';
import { loadOpsContext, listWorkflows } from './context-loader';
import { OPS_SKILLS } from './skills';
import { OPS_TOOL_SCHEMAS, READ_ONLY_OPS_TOOLS, OPS_SKILL_TOOLS } from './tool-schemas';

export interface RunWorkflowInput {
  type: 'run_workflow';
  workflow: string;
  brief: string;
}

export interface OpsFreeformInput {
  type: 'freeform';
  prompt: string;
  history?: ProviderMessage[];
}

export interface TrustGraduationNudgesInput {
  type: 'trust_graduation_nudges';
}

export type OpsTaskInput = RunWorkflowInput | OpsFreeformInput | TrustGraduationNudgesInput;

export class NixOpsAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    const ctx = loadOpsContext();
    const tools = [
      'sheets_read',
      'list_workflows',
      // Not LLM-facing (no entry in OPS_TOOL_SCHEMAS) — only authorizes
      // agent.useTool() calls made internally by run-workflow's WordPress
      // publish step, never a direct model tool call.
      'wordpress_publish_draft',
      'wordpress_upload_media',
      'wordpress_list_posts',
      'image_generate',
      'youtube_search_videos',
    ];
    const config: AgentConfig = {
      // 'strategy' is the unclaimed slot in the core role union; NixOps owns it.
      role: 'strategy',
      name: 'NixOps',
      systemPrompt: [
        ctx.soul,
        ctx.identity,
        ctx.user,
        `DELEGATION:
If the request needs something outside ops/workflow work — email/calendar (Admin), a written
post (Content), web research (Research), a go-to-market strategy (GTM), or GitHub repo work
(GitHub Dev) — use delegate_to_agent instead of guessing or doing a worse version yourself.
Never delegate something you can already do with your own tools.`,
      ].join('\n\n---\n\n'),
      tools,
      // Skill-tools (run_workflow_skill) are added to the model-facing
      // schema list here but deliberately NOT to `tools` above — they're
      // dispatched via invokeSkill(), never useTool()/MCP, so they have no
      // business in the MCP authorization list.
      toolSchemas: {
        ...Object.fromEntries(
          [...tools, ...OPS_SKILL_TOOLS]
            .filter((name) => name in OPS_TOOL_SCHEMAS)
            .map((name) => [name, OPS_TOOL_SCHEMAS[name]])
        ),
        [DELEGATE_TOOL_NAME]: buildDelegateToolSchema('strategy'),
      },
      maxTokens: 8192,
    };
    super(config, deps);
    for (const skill of OPS_SKILLS) {
      this.skills.registerSkill(skill);
    }
  }

  workflows(): string[] {
    return listWorkflows();
  }

  // run() is inherited from BaseAgent — see skills/ for each capability.

  // ─── TOOL-CALLING LOOP HOOKS (used by BaseAgent.runToolLoop) ──────

  protected isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_OPS_TOOLS.has(toolName);
  }

  protected async executeToolCall(
    task: AgentTask,
    call: ProviderToolCall
  ): Promise<{ result: unknown; isError: boolean }> {
    try {
      if (call.name === DELEGATE_TOOL_NAME) {
        return this.executeDelegateToAgent(task, call);
      }

      if (OPS_SKILL_TOOLS.has(call.name)) {
        // Skill-tools self-gate their own mutations via internal
        // proposeAction() calls (run_workflow does, for its final delivery
        // step) — dispatch immediately rather than approval-gating a
        // second time.
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
