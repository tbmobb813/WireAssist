import type { Skill } from '@wireassist/core';
import { loadWorkflow, parseSheetRef } from '../context-loader';
import { getTrustStage } from '../trust-stage';
import { logRun } from '../run-log';

export interface RunWorkflowInput {
  workflow: string;
  brief: string;
}

interface StageResult {
  stage: 'diagnose' | 'assemble' | 'take_action' | 'assess';
  content: string;
}

// DATA loop: Diagnose -> Assemble -> Take Action -> Assess
export const runWorkflowSkill: Skill<RunWorkflowInput, void> = {
  name: 'run_workflow',
  role: 'strategy',
  description: 'Run a named NixOps workflow through the DATA loop.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    const workflow = loadWorkflow(input.workflow);
    const priorRuns = await agent.loadContext(`workflow ${input.workflow}`);
    const stages: StageResult[] = [];

    // setTrustStage() keeps the workflow file's own "**Trust stage:**" line in
    // sync whenever JNix changes it via the dashboard, so this value and that
    // line always agree — this note just states it plainly up front so every
    // DATA-loop stage (including the final report) has it without re-parsing
    // the workflow file's markdown each time.
    const trustStage = getTrustStage(input.workflow);
    const trustStageNote =
      trustStage >= 3
        ? `CURRENT TRUST STAGE FOR THIS WORKFLOW: ${trustStage} (matches the workflow file's own "Trust stage" line — JNix advanced this workflow past Stage 2 via the dashboard). This run auto-delivers without human approval.`
        : `CURRENT TRUST STAGE FOR THIS WORKFLOW: ${trustStage} (matches the workflow file's own "Trust stage" line). This run requires human approval before delivery.`;

    const stage = async (
      name: StageResult['stage'],
      instruction: string,
      extra?: string
    ): Promise<string> => {
      const content = await agent.think(
        [
          `WORKFLOW FILE:\n${workflow}`,
          trustStageNote,
          `TASK BRIEF FROM JNIX:\n${input.brief}`,
          extra ? `PRIOR STAGES:\n${extra}` : '',
          `CURRENT STAGE — ${name.toUpperCase()}:\n${instruction}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        priorRuns || undefined
      );
      stages.push({ stage: name, content });
      agent.emit('agent:ops_stage_complete', {
        agentRole: task.agentRole,
        taskId: task.id,
        stage: name,
      });
      return content;
    };

    const transcript = () =>
      stages.map((s) => `### ${s.stage.toUpperCase()}\n${s.content}`).join('\n\n');

    // SOUL.md's Diagnose step: "Pull the current real state (inbox, sheet,
    // API, files)." A workflow file opts in with a "**Sheet:**" line
    // (see parseSheetRef); workflows without one just skip this.
    const sheetRef = parseSheetRef(workflow);
    let sheetContext = '';
    if (sheetRef) {
      try {
        const sheet = (await agent.useTool('sheets_read', {
          spreadsheetId: sheetRef.spreadsheetId,
          range: sheetRef.range,
        })) as { range: string; values: string[][] };
        sheetContext =
          `CURRENT SHEET STATE (${sheet.range}):\n` +
          (sheet.values.length > 0
            ? sheet.values.map((row) => row.join(' | ')).join('\n')
            : '(no rows)');
      } catch (err) {
        sheetContext =
          `SHEET READ FAILED for ${sheetRef.spreadsheetId} (${sheetRef.range}): ` +
          (err instanceof Error ? err.message : String(err)) +
          '\nTreat sheet-derived inputs as unavailable — do not assume stale/cached values.';
      }
    }

    const diagnosis = await stage(
      'diagnose',
      [
        'Check the workflow inputs against the brief. List unfilled TODOs or missing inputs.',
        sheetContext,
        'End with exactly one line: "VERDICT: PROCEED" if the workflow can run, or ' +
          '"VERDICT: BLOCKED — <reason>" if a required input is missing per the escalation rules.',
      ]
        .filter(Boolean)
        .join('\n\n')
    );

    if (/VERDICT:\s*BLOCKED/i.test(diagnosis)) {
      task.output = { blocked: true, diagnosis };
      logRun(input.workflow, 'BLOCKED', `Brief: ${input.brief}\n\n${diagnosis}`);
      agent.emit('agent:ops_blocked', {
        agentRole: task.agentRole,
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

    // Trust stage 2 (default): nothing is delivered until JNix approves.
    // Stage 3+: this workflow has been explicitly advanced past that gate —
    // deliver without asking. Stage 3 vs 4 differ only in who triggers the
    // run (a human vs. an unattended cron); the code path is identical.
    // (trustStage was already read at the top of this skill so the model's
    // own prompt context stays in sync with this decision.)
    const autoApproved = trustStage >= 3;
    const approved = autoApproved
      ? true
      : await agent.proposeAction(task, 'deliver_workflow_output', {
          workflow: input.workflow,
          brief: input.brief,
          assessment,
        });

    task.output = {
      workflow: input.workflow,
      approved,
      autoApproved,
      transcript: transcript(),
    };

    const outcomeLabel = autoApproved ? 'AUTO-APPROVED' : approved ? 'APPROVED' : 'REJECTED';

    // Full transcript, not a truncated summary — this is the only place the
    // run's actual deliverables survive once the task itself is discarded.
    agent.remember(
      `NixOps run of "${input.workflow}" (${outcomeLabel}). Brief: ${input.brief}.\n\n${transcript()}`,
      ['ops-run', input.workflow]
    );
    logRun(input.workflow, outcomeLabel, `Brief: ${input.brief}\n\n${transcript()}`);

    agent.emit('agent:ops_run_complete', {
      agentRole: task.agentRole,
      taskId: task.id,
      workflow: input.workflow,
      approved,
      autoApproved,
      transcript: transcript(),
    });
  },
};
