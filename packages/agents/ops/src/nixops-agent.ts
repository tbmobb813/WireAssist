import {
  type AgentConfig,
  type AgentTask,
  type IApprovalQueue,
  type MemoryStore,
  type MCPClient,
  type EventBus,
} from '@wireassist/core';
import { BaseAgent } from '@wireassist/agent-admin';
import { loadOpsContext, loadWorkflow, listWorkflows } from './context-loader';

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

interface StageResult {
  stage: 'diagnose' | 'assemble' | 'take_action' | 'assess';
  content: string;
}

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
      tools: [],
      maxTokens: 8192,
    };
    super(config, deps);
  }

  workflows(): string[] {
    return listWorkflows();
  }

  async run(task: AgentTask): Promise<void> {
    if (this.status === 'running') return;

    this.status = 'running';
    this.events.emit('agent:task_started', {
      agentRole: this.role,
      agentName: this.name,
      taskId: task.id,
      description: task.description,
    });

    try {
      const input = task.input as unknown as OpsTaskInput;
      switch (input.type) {
        case 'run_workflow':
          await this.runWorkflow(task, input);
          break;
        case 'freeform':
          await this.runFreeform(task, input);
          break;
        default:
          throw new Error(`Unknown ops task type: ${(input as { type?: string }).type}`);
      }
      this.status = 'idle';
    } catch (err) {
      this.status = 'error';
      this.events.emit('agent:task_failed', {
        agentRole: this.role,
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ── DATA loop: Diagnose → Assemble → Take Action → Assess ────────────────
  private async runWorkflow(task: AgentTask, input: RunWorkflowInput): Promise<void> {
    const workflow = loadWorkflow(input.workflow);
    const priorRuns = await this.loadContext(`workflow ${input.workflow}`);
    const stages: StageResult[] = [];

    const stage = async (
      name: StageResult['stage'],
      instruction: string,
      extra?: string
    ): Promise<string> => {
      const content = await this.think(
        [
          `WORKFLOW FILE:\n${workflow}`,
          `TASK BRIEF FROM JNIX:\n${input.brief}`,
          extra ? `PRIOR STAGES:\n${extra}` : '',
          `CURRENT STAGE — ${name.toUpperCase()}:\n${instruction}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        priorRuns || undefined
      );
      stages.push({ stage: name, content });
      this.events.emit('agent:ops_stage_complete', {
        agentRole: this.role,
        taskId: task.id,
        stage: name,
      });
      return content;
    };

    const transcript = () =>
      stages.map((s) => `### ${s.stage.toUpperCase()}\n${s.content}`).join('\n\n');

    const diagnosis = await stage(
      'diagnose',
      'Check the workflow inputs against the brief. List unfilled TODOs or missing inputs. ' +
        'End with exactly one line: "VERDICT: PROCEED" if the workflow can run, or ' +
        '"VERDICT: BLOCKED — <reason>" if a required input is missing per the escalation rules.'
    );

    if (/VERDICT:\s*BLOCKED/i.test(diagnosis)) {
      task.output = { blocked: true, diagnosis };
      this.events.emit('agent:ops_blocked', {
        agentRole: this.role,
        taskId: task.id,
        diagnosis,
      });
      return;
    }

    await stage(
      'assemble',
      'Write the execution plan as a markdown checklist mapping each step to a Definition of Done item.',
      transcript()
    );

    await stage(
      'take_action',
      'Execute the plan: produce every artifact the Definition of Done requires, in full, ' +
        'as clearly separated markdown sections (one per artifact, titled with its filename).',
      transcript()
    );

    const assessment = await stage(
      'assess',
      'Grade the produced artifacts against every Definition of Done checkbox. Fix any gaps by ' +
        'restating the corrected artifact in full. Then give a run report: what was done, what was ' +
        'verified, unresolved items, and exactly one suggested improvement to the workflow file.',
      transcript()
    );

    // Trust Stage 2: nothing is delivered until JNix approves the assessed output.
    const approved = await this.proposeAction(task, 'deliver_workflow_output', {
      workflow: input.workflow,
      brief: input.brief,
      assessment,
    });

    task.output = {
      workflow: input.workflow,
      approved,
      transcript: transcript(),
    };

    this.remember(
      `NixOps run of "${input.workflow}" (${approved ? 'approved' : 'rejected'}). Brief: ${input.brief}. ` +
        `Assessment summary: ${assessment.slice(0, 500)}`,
      ['ops-run', input.workflow]
    );

    this.events.emit('agent:ops_run_complete', {
      agentRole: this.role,
      taskId: task.id,
      workflow: input.workflow,
      approved,
    });
  }

  private async runFreeform(task: AgentTask, input: OpsFreeformInput): Promise<void> {
    const context = await this.loadContext(input.prompt);
    const response = await this.think(input.prompt, context || undefined);
    task.output = { response };
    this.events.emit('agent:ops_freeform_response', {
      agentRole: this.role,
      taskId: task.id,
      response,
    });
  }
}
