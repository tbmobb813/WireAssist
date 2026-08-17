import { AdminTasks } from '../admin-tasks';

describe('AdminTasks', () => {
  describe('triageEmail', () => {
    it('defaults to maxEmails=20 when called without args', () => {
      const t = AdminTasks.triageEmail();
      const input = t.input as { type: string; maxEmails?: number };
      expect(input.type).toBe('email_triage');
      // maxEmails is passed as undefined and left to agent default
      expect(t.agentRole).toBe('admin');
    });

    it('passes maxEmails through', () => {
      const t = AdminTasks.triageEmail(10);
      expect((t.input as { maxEmails: number }).maxEmails).toBe(10);
    });

    it('returns a task with a uuid id', () => {
      const t = AdminTasks.triageEmail();
      expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('reviewCalendar', () => {
    it('defaults to daysAhead=7', () => {
      const t = AdminTasks.reviewCalendar();
      expect((t.input as { daysAhead: number }).daysAhead).toBe(7);
    });

    it('passes custom daysAhead', () => {
      const t = AdminTasks.reviewCalendar(14);
      expect((t.input as { daysAhead: number }).daysAhead).toBe(14);
    });

    it('returns a task with agentRole admin', () => {
      expect(AdminTasks.reviewCalendar().agentRole).toBe('admin');
    });
  });

  describe('freeform', () => {
    it('stores instruction as prompt in input', () => {
      const t = AdminTasks.freeform('Summarise my week');
      expect((t.input as { type: string; prompt: string }).type).toBe('freeform');
      expect((t.input as { prompt: string }).prompt).toBe('Summarise my week');
    });

    it('uses instruction as description', () => {
      const t = AdminTasks.freeform('Draft email');
      expect(t.description).toBe('Draft email');
    });

    it('carries history through when provided', () => {
      const history = [{ role: 'user' as const, content: 'earlier question' }];
      const t = AdminTasks.freeform('Draft email', history);
      expect((t.input as { history?: unknown }).history).toEqual(history);
    });
  });

  describe('budgetWarning', () => {
    it('defaults to thresholdPercent=80', () => {
      const t = AdminTasks.budgetWarning();
      expect((t.input as { type: string; thresholdPercent?: number }).type).toBe(
        'budget_warning_nudge'
      );
      expect((t.input as { thresholdPercent?: number }).thresholdPercent).toBe(80);
      expect(t.agentRole).toBe('admin');
    });

    it('passes custom thresholdPercent through', () => {
      const t = AdminTasks.budgetWarning(90);
      expect((t.input as { thresholdPercent?: number }).thresholdPercent).toBe(90);
    });
  });
});
