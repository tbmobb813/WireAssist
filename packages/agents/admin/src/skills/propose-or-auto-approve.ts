import type { AgentTask, SkillAgentHandle } from '@wireassist/core';
import type { ProposedAction } from '../types';
import {
  isAutoApproveEligibleType,
  isEligibleForAutoApproval,
  recordDecision,
} from '../auto-approve-policy';

// Wraps agent.proposeAction() with the narrow auto-approval policy from
// auto-approve-policy.ts. Eligibility is hardcoded there (only
// ignore-labeling a thread, keyed by sender) — everything else always goes
// through the normal human approval gate. Shared by the email-triage skill
// and AdminAgent's chat tool loop (executeToolCall).
export async function proposeOrAutoApprove(
  agent: SkillAgentHandle,
  task: AgentTask,
  action: ProposedAction
): Promise<boolean> {
  const from = typeof action.payload.from === 'string' ? action.payload.from : undefined;

  if (from && isAutoApproveEligibleType(action) && isEligibleForAutoApproval(from)) {
    agent.remember(`Auto-approved: ${action.label}`, ['email', 'auto-approval', action.type]);
    agent.emit('agent:auto_approved', { agentRole: task.agentRole, taskId: task.id, action });
    return true;
  }

  const approved = await agent.proposeAction(task, action.label, action.payload);
  if (from && isAutoApproveEligibleType(action)) {
    recordDecision(from, approved);
  }
  agent.remember(approved ? `User approved: ${action.label}` : `User rejected: ${action.label}`, [
    'email',
    approved ? 'approval' : 'rejection',
    action.type,
  ]);
  return approved;
}

// Batch counterpart used by email-triage.ts. A triage run can propose many
// actions (draft a reply, label urgent, label ignore) across many emails —
// approving them one at a time, sequentially, meant approval #1 of 5
// blocked the entire (serialized) task queue until resolved, then #2, then
// #3. Each of those actions is already a real, final effect (there's no
// separate draft phase the way Content has draft-vs-publish) — the actual
// problem was one approval prompt per action instead of one per run.
//
// Auto-approve-eligible actions (the narrow ignore-labeling-for-a-trusted-
// sender carve-out) still execute immediately with no prompt, exactly as
// before — only genuinely human-decision actions get bundled into a single
// batch request. Approving/rejecting the batch approves/rejects every
// action in it; there's no partial approval within one batch.
export async function proposeBatchOrAutoApprove(
  agent: SkillAgentHandle,
  task: AgentTask,
  actions: ProposedAction[]
): Promise<void> {
  const autoApproved: ProposedAction[] = [];
  const needsApproval: ProposedAction[] = [];

  for (const action of actions) {
    const from = typeof action.payload.from === 'string' ? action.payload.from : undefined;
    if (from && isAutoApproveEligibleType(action) && isEligibleForAutoApproval(from)) {
      autoApproved.push(action);
    } else {
      needsApproval.push(action);
    }
  }

  for (const action of autoApproved) {
    agent.remember(`Auto-approved: ${action.label}`, ['email', 'auto-approval', action.type]);
    agent.emit('agent:auto_approved', { agentRole: task.agentRole, taskId: task.id, action });
    await agent.useTool(action.type, action.payload);
  }

  if (needsApproval.length === 0) return;

  // A single item keeps its own specific label — no reason to generalize
  // "Approve 1 triage actions?" when the existing per-action wording
  // already says exactly what it is.
  const label =
    needsApproval.length === 1
      ? needsApproval[0].label
      : `Approve ${needsApproval.length} triage actions?`;

  const approved = await agent.proposeAction(task, label, { actions: needsApproval });

  for (const action of needsApproval) {
    const from = typeof action.payload.from === 'string' ? action.payload.from : undefined;
    if (from && isAutoApproveEligibleType(action)) {
      recordDecision(from, approved);
    }
    agent.remember(approved ? `User approved: ${action.label}` : `User rejected: ${action.label}`, [
      'email',
      approved ? 'approval' : 'rejection',
      action.type,
    ]);
    if (approved) {
      await agent.useTool(action.type, action.payload);
    }
  }
}
