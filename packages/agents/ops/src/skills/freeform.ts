import { createFreeformSkill } from '@wireassist/core';

// Ops is the one agent whose freeform task always carries a real prompt (no
// task.description fallback needed in practice — every real caller supplies
// one), and whose completion event carries an extra agentRole field and
// assigns task.output before emitting, unlike the other five agents.
export const opsFreeformSkill = createFreeformSkill({
  role: 'strategy',
  description: 'Open-ended question about the business/ops workflows.',
  // A real business question plausibly chains several raw read calls
  // (sheets_read, list_workflows, a content-check call) before answering —
  // same cap-exhaustion risk already confirmed live on Admin and GitHub's
  // freeform loops.
  maxIterations: 12,
  resolvePrompt: (task, input) => input.prompt ?? task.description,
  buildCompletionEvent: ({ task, response }) => ({
    event: 'agent:ops_freeform_response',
    payload: { agentRole: task.agentRole, taskId: task.id, response },
  }),
  onBeforeEmit: (task, response) => {
    task.output = { response };
  },
});
