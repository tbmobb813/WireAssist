import {
  createEmailTriageTask,
  createCalendarReviewTask,
  createSendEmailTask,
  createScheduleEventTask,
  createFreeformTask,
} from '../task-factory';

describe('createEmailTriageTask', () => {
  it('produces a valid task with defaults', () => {
    const t = createEmailTriageTask();
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.agentRole).toBe('admin');
    expect(t.status).toBe('queued');
    expect(t.approvalRequired).toBe(true);
    expect(t.description.length).toBeGreaterThan(0);
    expect((t.input as { type: string; maxEmails?: number }).type).toBe('email_triage');
    expect((t.input as { maxEmails?: number }).maxEmails).toBeUndefined();
  });

  it('passes maxEmails through', () => {
    const t = createEmailTriageTask({ maxEmails: 5 });
    expect((t.input as { maxEmails: number }).maxEmails).toBe(5);
  });

  it('uses custom description when provided', () => {
    const t = createEmailTriageTask({ description: 'Custom desc' });
    expect(t.description).toBe('Custom desc');
  });
});

describe('createCalendarReviewTask', () => {
  it('defaults daysAhead to 7', () => {
    const t = createCalendarReviewTask();
    expect((t.input as { type: string; daysAhead: number }).type).toBe('calendar_review');
    expect((t.input as { daysAhead: number }).daysAhead).toBe(7);
    expect(t.agentRole).toBe('admin');
    expect(t.approvalRequired).toBe(true);
  });

  it('passes custom daysAhead', () => {
    const t = createCalendarReviewTask({ daysAhead: 14 });
    expect((t.input as { daysAhead: number }).daysAhead).toBe(14);
  });
});

describe('createSendEmailTask', () => {
  const base = { to: 'a@b.com', subject: 'Hello', body: 'Body text' };

  it('produces correct task shape', () => {
    const t = createSendEmailTask(base);
    expect(t.agentRole).toBe('admin');
    expect(t.approvalRequired).toBe(true);
    const input = t.input as { type: string; to: string; subject: string; body: string; threadId?: string };
    expect(input.type).toBe('send_email');
    expect(input.to).toBe('a@b.com');
    expect(input.subject).toBe('Hello');
    expect(input.body).toBe('Body text');
    expect(input.threadId).toBeUndefined();
  });

  it('includes threadId when provided', () => {
    const t = createSendEmailTask({ ...base, threadId: 'thread-1' });
    expect((t.input as { threadId: string }).threadId).toBe('thread-1');
  });

  it('auto-generates description from to/subject', () => {
    const t = createSendEmailTask(base);
    expect(t.description).toContain('a@b.com');
    expect(t.description).toContain('Hello');
  });
});

describe('createScheduleEventTask', () => {
  const params = { summary: 'Standup', start: '2026-06-01T09:00:00Z', end: '2026-06-01T09:30:00Z' };

  it('produces correct task shape', () => {
    const t = createScheduleEventTask(params);
    expect(t.agentRole).toBe('admin');
    expect(t.approvalRequired).toBe(true);
    const input = t.input as { type: string; summary: string };
    expect(input.type).toBe('schedule_event');
    expect(input.summary).toBe('Standup');
  });

  it('includes attendees when provided', () => {
    const t = createScheduleEventTask({ ...params, attendees: ['b@c.com'] });
    expect((t.input as { attendees: string[] }).attendees).toEqual(['b@c.com']);
  });
});

describe('createFreeformTask', () => {
  it('produces correct task shape', () => {
    const t = createFreeformTask({ prompt: 'What should I focus on today?' });
    expect(t.agentRole).toBe('admin');
    expect(t.approvalRequired).toBe(true);
    const input = t.input as { type: string; prompt: string };
    expect(input.type).toBe('freeform');
    expect(input.prompt).toBe('What should I focus on today?');
  });

  it('uses prompt as description when no description provided', () => {
    const t = createFreeformTask({ prompt: 'Draft a reply' });
    expect(t.description).toBe('Draft a reply');
  });

  it('uses custom description when provided', () => {
    const t = createFreeformTask({ prompt: 'p', description: 'Custom' });
    expect(t.description).toBe('Custom');
  });
});
