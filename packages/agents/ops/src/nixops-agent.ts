import {
  type AgentConfig,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { loadOpsContext, listWorkflows } from './context-loader';
import { OPS_SKILLS } from './skills';

export interface RunWorkflowInput {
  type: 'run_workflow';
  workflow: string;
  brief: string;
}

export interface OpsFreeformInput {
  type: 'freeform';
  prompt: string;
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
    const config: AgentConfig = {
      // 'strategy' is the unclaimed slot in the core role union; NixOps owns it.
      role: 'strategy',
      name: 'NixOps',
      systemPrompt: [ctx.soul, ctx.identity, ctx.user].join('\n\n---\n\n'),
      tools: ['sheets_read'],
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
}
