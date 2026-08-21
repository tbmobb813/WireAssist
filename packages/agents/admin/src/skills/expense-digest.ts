import type { Skill } from '@wireassist/core';
import type { GmailThread } from '../types';

const DEFAULT_DAYS_AGO = 30;

// Distinct from budget_warning_nudge, which tracks WireAssist's own
// AI-spend cap — this is the real personal/business expense-tracking duty,
// built off whatever receipt and invoice emails have already landed.
const EXPENSE_QUERY = 'subject:(receipt OR invoice OR "order confirmation" OR "payment received")';

export interface ExpenseDigestInput {
  daysAgo?: number;
}

export const expenseDigestSkill: Skill<ExpenseDigestInput, void> = {
  name: 'expense_digest',
  role: 'admin',
  description:
    'Scan recent receipts and invoices in Gmail and summarize spend by category over a window.',

  async execute({ agent, task, input }) {
    const daysAgo = input.daysAgo ?? DEFAULT_DAYS_AGO;

    const threads = (await agent.useTool('gmail_search', {
      q: `${EXPENSE_QUERY} newer_than:${daysAgo}d`,
      maxResults: 40,
    })) as GmailThread[];

    if (threads.length === 0) {
      agent.emit('agent:expense_digest_complete', {
        taskId: task.id,
        summary: `No receipts or invoices found in the last ${daysAgo} days.`,
        hasExpenses: false,
      });
      return;
    }

    const digestPrompt = `Summarize personal/business spend for Jason from the receipt and invoice
emails below, covering the last ${daysAgo} days. Group by rough category (e.g. software,
travel, meals, office, other) and give an approximate total per category where the snippet makes
the amount legible. If amounts aren't legible from the snippets alone, say so rather than
guessing a number.

RECEIPT / INVOICE EMAILS:
${threads.map((t) => `- ${t.snippet}`).join('\n')}`;

    const summary = await agent.think(digestPrompt);

    agent.emit('agent:expense_digest_complete', {
      taskId: task.id,
      summary,
      hasExpenses: true,
    });
  },
};
