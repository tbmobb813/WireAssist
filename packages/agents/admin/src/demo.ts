/* eslint-disable no-console */

import readline from 'readline';
import { MemoryStore, MCPClient, EventBus, type IApprovalQueue } from '@wireassist/core';
import { logger } from '@wireassist/core/logger';
import { AdminAgent } from './admin-agent';
import { setupAdminMCP } from './mcp-setup';
import { AdminTasks } from './admin-tasks';
import { createEmailTriageTask } from './task-factory';
import type { ChatDispatch } from './chat-dispatch';

// This CLI demo only exercises email triage — chat dispatch (writing a
// post, running research, etc.) isn't part of this flow, so a stub that
// errors loudly beats silently wiring up real network/task-queue behavior
// nothing here would ever actually use.
const notImplementedInDemo: ChatDispatch = {
  contentPost: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  contentPlan: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  contentFreeform: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  researchTopic: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  researchFreeform: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  opsWorkflow: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  opsFreeform: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  gtmFreeform: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  githubFreeform: () => Promise.reject(new Error('chat dispatch not supported in demo.ts')),
  redirectToGtmWizard: () => ({ redirect: '/gtm', message: 'Not supported in demo.ts.' }),
};

/**
 * Simple CLI-based ApprovalQueue implementation that asks the user [y/n]
 * for each proposed action. This is intentionally in-memory and does not
 * persist to SQLite; it is only used for the demo.
 */
class CliApprovalQueue implements IApprovalQueue {
  // These properties satisfy the structural type of ApprovalQueue
  // used by the agent, but are no-ops for the demo.

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getPending(): never[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getOrphanedApprovals(): never[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getResolved(): never[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  resolve(_id: string, _approved: boolean): void {
    // No-op in CLI mode – approvals are handled inline.
  }

  request(params: {
    taskId: string;
    agentRole: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      logger.info('\n──────────────────────────────────────────────');
      logger.info(`[APPROVAL REQUEST] (${params.agentRole} :: ${params.taskId})`);
      logger.info(`Action: ${params.action}`);
      logger.debug('Payload:', JSON.stringify(params.payload, null, 2));
      logger.info('Approve? [y/n]');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('> ', (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();
        const approved = normalized === 'y' || normalized === 'yes';
        logger.info(approved ? '✅ Approved' : '❌ Rejected');
        resolve(approved);
      });
    });
  }
}

async function runDemo(): Promise<void> {
  logger.info('=== WireAssist Admin Agent Demo ===');
  logger.info(
    'This demo triages Gmail and reviews calendar; approvals are [y/n] in the terminal.\n'
  );

  // Core dependencies
  const memory = new MemoryStore(':memory:');
  const mcp = new MCPClient();
  const events = new EventBus();
  const approval = new CliApprovalQueue();

  // Wire up mock Gmail + Calendar tools
  await setupAdminMCP(mcp);

  // Basic logging so we can observe the agent behavior
  events.on('agent:task_started', (payload) => {
    logger.info('\n[EVENT] task_started:', payload);
  });

  events.on('agent:triage_complete', (payload) => {
    logger.info('\n[EVENT] triage_complete:');
    logger.debug(payload);
  });

  events.on('agent:approval_resolved', (payload) => {
    logger.info('\n[EVENT] approval_resolved:', payload);
  });

  events.on('agent:task_complete', (payload) => {
    logger.info('\n[EVENT] task_complete:', payload);
  });

  // Create the Admin Agent
  const agent = new AdminAgent({
    approval,
    memory,
    mcp,
    events,
    chatDispatch: notImplementedInDemo,
  });

  // Build a mock email triage task and run it end-to-end.
  const task = createEmailTriageTask({
    maxEmails: 5,
  });

  logger.info('\nRunning email triage task...');
  await agent.run(task);

  logger.info('\nRunning calendar review...');
  const calTask = AdminTasks.reviewCalendar(7);
  await agent.run(calTask);
  logger.info('\nDemo complete. Press Ctrl+C to exit.');
}

runDemo().catch((err) => {
  logger.error('Demo failed:', err);
  process.exitCode = 1;
});
