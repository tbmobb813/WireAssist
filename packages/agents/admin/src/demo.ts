/* eslint-disable no-console */

import readline from 'readline';
import { MemoryStore, MCPClient, EventBus, type IApprovalQueue } from '@synqworks/core';
import { AdminAgent } from './admin-agent';
import { setupAdminMCP } from './mcp-setup';
import { createEmailTriageTask, createCalendarReviewTask } from './task-factory';

const AdminTasks = {
  reviewCalendar(daysAhead: number) {
    return createCalendarReviewTask({ daysAhead });
  },
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
      console.log('\n──────────────────────────────────────────────');
      console.log(`[APPROVAL REQUEST] (${params.agentRole} :: ${params.taskId})`);
      console.log(`Action: ${params.action}`);
      console.log('Payload:', JSON.stringify(params.payload, null, 2));
      console.log('Approve? [y/n]');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('> ', (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();
        const approved = normalized === 'y' || normalized === 'yes';
        console.log(approved ? '✅ Approved' : '❌ Rejected');
        resolve(approved);
      });
    });
  }
}

async function runDemo(): Promise<void> {
  console.log('=== SynqWorks Admin Agent Demo ===');
  console.log('This demo triages mock Gmail threads and asks for [y/n] approvals.\n');

  // Core dependencies
  const memory = new MemoryStore(':memory:');
  const mcp = new MCPClient();
  const events = new EventBus();
  const approval = new CliApprovalQueue();

  // Wire up mock Gmail + Calendar tools
  await setupAdminMCP(mcp);

  // Basic logging so we can observe the agent behavior
  events.on('agent:task_started', (payload) => {
    console.log('\n[EVENT] task_started:', payload);
  });

  events.on('agent:triage_complete', (payload) => {
    console.log('\n[EVENT] triage_complete:');
    console.dir(payload, { depth: null });
  });

  events.on('agent:approval_resolved', (payload) => {
    console.log('\n[EVENT] approval_resolved:', payload);
  });

  events.on('agent:task_complete', (payload) => {
    console.log('\n[EVENT] task_complete:', payload);
  });

  // Create the Admin Agent
  const agent = new AdminAgent({
    approval,
    memory,
    mcp,
    events,
  });

  // Build a mock email triage task and run it end-to-end.
  const task = createEmailTriageTask({
    maxEmails: 5,
  });

  console.log('\nRunning email triage task...');
  await agent.triageEmail(task);

  // Run a calendar review after triage to demonstrate a second admin workflow.
  console.log('\nRunning calendar review...');
  const calTask = AdminTasks.reviewCalendar(7);
  await agent.run(calTask);

  console.log('\nDemo complete. Press Ctrl+C to exit.');
}

runDemo().catch((err) => {
  console.error('Demo failed:', err);
  process.exitCode = 1;
});

