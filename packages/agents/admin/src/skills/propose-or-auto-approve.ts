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
