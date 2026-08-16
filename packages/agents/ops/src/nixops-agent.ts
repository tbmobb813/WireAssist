import {
  type AgentConfig,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
  type ProviderMessage,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { loadOpsContext, listWorkflows } from './context-loader';
import { OPS_SKILLS } from './skills';
import { OPS_TOOL_SCHEMAS, READ_ONLY_OPS_TOOLS } from './tool-schemas';

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

export type OpsTaskInput = RunWorkflowInput | OpsFreeformInput;

export class NixOpsAgent extends BaseAgent {
  constructor(deps: {
    approval: IApprovalQueue;
    memory: MemoryStore;
    mcp: MCPClient;
    events: EventBus;
  }) {
    const ctx = loadOpsContext();
    const tools = ['sheets_read'];
    const config: AgentConfig = {
      // 'strategy' is the unclaimed slot in the core role union; NixOps owns it.
      role: 'strategy',
      name: 'NixOps',
      systemPrompt: [ctx.soul, ctx.identity, ctx.user].join('\n\n---\n\n'),
      tools,
      toolSchemas: Object.fromEntries(
        tools
          .filter((name) => name in OPS_TOOL_SCHEMAS)
          .map((name) => [name, OPS_TOOL_SCHEMAS[name]])
      ),
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
}
