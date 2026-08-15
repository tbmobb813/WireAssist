import type { AgentTask, AgentRole } from '@wireassist/core';

export type HandoffQueues = Partial<Record<AgentRole, (task: AgentTask) => void>>;

// Routes an agent:handoff_requested task to the right per-agent queue by
// task.agentRole. Pulled out of server.ts as a pure function so it's
// testable without bootstrapping the full server (agents/DB).
export function routeHandoffTask(task: AgentTask, queues: HandoffQueues): boolean {
  const queue = queues[task.agentRole];
  if (!queue) {
    console.error(`agent:handoff_requested — unknown target role: ${task.agentRole}`);
    return false;
  }
  queue(task);
  return true;
}
