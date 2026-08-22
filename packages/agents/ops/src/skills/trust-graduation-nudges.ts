import type { ApprovalRequest, Skill } from '@wireassist/core';
import { getTrustStage, setTrustStage } from '../trust-stage';
import { listWorkflows } from '../context-loader';

// Same bar as AUTO_APPROVE_THRESHOLD (admin/auto-approve-policy.ts) and
// STREAK_LENGTH (admin/skills/proactive-insights.ts) — 3 in a row is the
// pattern-not-a-one-off threshold used everywhere else in the codebase.
const STREAK_LENGTH = 3;

export interface GraduationCandidate {
  workflow: string;
  streak: number;
}

// Groups resolved deliver_workflow_output approvals by payload.workflow —
// not by `action`, since every NixOps approval shares that one string
// ("deliver_workflow_output"); the real per-run identity lives in the
// payload (see run-workflow.ts's proposeAction call). Flags any workflow
// whose most recent STREAK_LENGTH decisions were all approved.
export function findGraduationCandidates(
  decisions: Pick<ApprovalRequest, 'action' | 'payload' | 'status'>[]
): GraduationCandidate[] {
  const groups = new Map<string, Pick<ApprovalRequest, 'status'>[]>();

  for (const d of decisions) {
    if (d.action !== 'deliver_workflow_output') continue;
    const workflow = d.payload?.workflow;
    if (typeof workflow !== 'string') continue;
    const group = groups.get(workflow) ?? [];
    group.push(d);
    groups.set(workflow, group);
  }

  const candidates: GraduationCandidate[] = [];
  for (const [workflow, group] of groups) {
    if (group.length < STREAK_LENGTH) continue;
    // decisions arrive newest-first from getResolved(); take the most
    // recent STREAK_LENGTH entries for this workflow.
    const recent = group.slice(0, STREAK_LENGTH);
    if (recent.every((d) => d.status === 'approved')) {
      candidates.push({ workflow, streak: recent.length });
    }
  }

  return candidates;
}

export const trustGraduationNudgesSkill: Skill<unknown, void> = {
  name: 'trust_graduation_nudges',
  role: 'strategy',
  description:
    "Nudge JNix to graduate a workflow's trust stage after a streak of consecutive approvals.",

  async execute({ agent, task }) {
    const decisions = agent.listDecisions({ agentRole: 'strategy', limit: 200 });
    const existingWorkflows = new Set(listWorkflows());
    // Already-graduated workflows have nothing left to nudge — and this is
    // also what keeps the signal clean, since stage 3+ runs skip
    // proposeAction() entirely and never reach the approval queue at all.
    // A workflow renamed/deleted since its approval history was recorded
    // has nothing to graduate either — its trust-stage entry would just
    // dangle since syncWorkflowFile() no-ops on a missing file.
    const candidates = findGraduationCandidates(decisions).filter(
      (c) => getTrustStage(c.workflow) === 2 && existingWorkflows.has(c.workflow)
    );

    if (candidates.length === 0) {
      agent.emit('agent:trust_graduation_nudges_complete', {
        taskId: task.id,
        summary: 'No workflows are ready to graduate trust stage yet.',
        candidates: [],
      });
      return;
    }

    const outcomes: (GraduationCandidate & { approved: boolean })[] = [];
    for (const candidate of candidates) {
      const approved = await agent.proposeAction(
        task,
        `Graduate workflow "${candidate.workflow}" to trust stage 3 (pre-approved — runs deliver ` +
          `without asking) after ${candidate.streak} consecutive approvals?`,
        {
          workflow: candidate.workflow,
          currentStage: 2,
          targetStage: 3,
          streak: candidate.streak,
        }
      );
      if (approved) {
        setTrustStage(candidate.workflow, 3);
      }
      outcomes.push({ ...candidate, approved });
    }

    const summaryPrompt = `Write a short, direct paragraph for Jason summarizing these NixOps
trust-stage graduation nudges. Name each workflow and its streak length, and say plainly whether
it was graduated or left as-is — no generic filler.

CANDIDATES:
${outcomes
  .map(
    (o) =>
      `- "${o.workflow}": ${o.streak} approvals in a row — ${
        o.approved ? 'graduated to stage 3' : 'left at stage 2'
      }`
  )
  .join('\n')}`;

    const summary = await agent.think(summaryPrompt);

    agent.emit('agent:trust_graduation_nudges_complete', {
      taskId: task.id,
      summary,
      candidates: outcomes,
    });
  },
};
