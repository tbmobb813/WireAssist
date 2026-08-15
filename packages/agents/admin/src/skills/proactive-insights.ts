import type { Skill } from '@wireassist/core';

// Same streak length as AUTO_APPROVE_THRESHOLD in auto-approve-policy.ts —
// 3 in a row is the bar for "this is a pattern, not a one-off" across both.
const STREAK_LENGTH = 3;

export interface DecisionFinding {
  agentRole: string;
  action: string;
  streak: 'rejected' | 'approved';
  count: number;
}

// Groups the shared approval_queue's resolved history by (agentRole, action)
// and flags any group whose most recent STREAK_LENGTH decisions were all the
// same outcome. Exact-string grouping is deliberate — no schema change
// needed, and many action labels are already stable strings ("Archive email
// thread"); parameterized ones naturally cluster on their fixed portion.
function findStreaks(
  decisions: { agentRole: string; action: string; status: string; createdAt: Date }[]
): DecisionFinding[] {
  const groups = new Map<string, { agentRole: string; action: string; status: string }[]>();

  for (const d of decisions) {
    const key = `${d.agentRole}::${d.action}`;
    const group = groups.get(key) ?? [];
    group.push(d);
    groups.set(key, group);
  }

  const findings: DecisionFinding[] = [];
  for (const group of groups.values()) {
    if (group.length < STREAK_LENGTH) continue;
    // decisions arrive newest-first from getResolved(); take the most
    // recent STREAK_LENGTH entries for this group.
    const recent = group.slice(0, STREAK_LENGTH);
    const allRejected = recent.every((d) => d.status === 'rejected');
    const allApproved = recent.every((d) => d.status === 'approved');
    if (!allRejected && !allApproved) continue;

    findings.push({
      agentRole: recent[0].agentRole,
      action: recent[0].action,
      streak: allRejected ? 'rejected' : 'approved',
      count: recent.length,
    });
  }

  return findings;
}

export const proactiveInsightsSkill: Skill<unknown, void> = {
  name: 'proactive_insights',
  role: 'admin',
  description:
    'Reflect on approval/rejection history across every agent and surface any repeated pattern unprompted.',

  async execute({ agent, task }) {
    const decisions = agent.listDecisions({ limit: 200 });
    const findings = findStreaks(decisions);

    if (findings.length === 0) {
      agent.emit('agent:proactive_insights_complete', {
        taskId: task.id,
        summary: 'No new patterns since last check.',
        findings: [],
      });
      return;
    }

    const findingsList = findings
      .map(
        (f) => `- ${f.agentRole}: "${f.action}" — ${f.streak} the last ${f.count} times in a row`
      )
      .join('\n');

    const digestPrompt = `Write a short, direct paragraph for Jason pointing out these repeated
approval/rejection patterns across his agents. Name the specific action and agent for each one —
no generic "you might want to review your settings" filler. If a pattern is a rejection streak,
suggest the agent stop proposing it (or ask what changed). If it's an approval streak, note it
could be a candidate for less friction.

PATTERNS:
${findingsList}`;

    const summary = await agent.think(digestPrompt);

    agent.emit('agent:proactive_insights_complete', {
      taskId: task.id,
      summary,
      findings,
    });
  },
};
