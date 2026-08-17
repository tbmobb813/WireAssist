import { randomUUID } from 'crypto';
import type { AgentTask, AgentRole, ProviderMessage } from '@wireassist/core';

type SupportedTaskInput =
  | { type: 'email_triage'; maxEmails?: number }
  | { type: 'calendar_review'; daysAhead?: number }
  | {
      type: 'send_email';
      to: string;
      subject: string;
      body: string;
      threadId?: string;
    }
  | {
      type: 'schedule_event';
      summary: string;
      start: string;
      end: string;
      attendees?: string[];
      description?: string;
    }
  | { type: 'freeform'; prompt: string; history?: ProviderMessage[] }
  | { type: 'daily_briefing'; maxEmails?: number; daysAhead?: number }
  | { type: 'follow_up_nudges'; daysStale?: number }
  | { type: 'proactive_insights' }
  | { type: 'stale_approvals_nudge'; daysStale?: number };

function baseTask(role: AgentRole, description: string, input: SupportedTaskInput): AgentTask {
  const now = new Date();
  return {
    id: randomUUID(),
    agentRole: role,
    description,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    input,
    approvalRequired: true,
  };
}

export function createEmailTriageTask(options?: {
  description?: string;
  maxEmails?: number;
}): AgentTask {
  return baseTask('admin', options?.description ?? 'Triage my inbox and propose actions.', {
    type: 'email_triage',
    maxEmails: options?.maxEmails,
  });
}

export function createCalendarReviewTask(options?: {
  description?: string;
  daysAhead?: number;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Review my upcoming calendar and suggest improvements.',
    {
      type: 'calendar_review',
      daysAhead: options?.daysAhead ?? 7,
    }
  );
}

export function createSendEmailTask(params: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  description?: string;
}): AgentTask {
  return baseTask(
    'admin',
    params.description ?? `Send an email to ${params.to} about "${params.subject}".`,
    {
      type: 'send_email',
      to: params.to,
      subject: params.subject,
      body: params.body,
      threadId: params.threadId,
    }
  );
}

export function createScheduleEventTask(params: {
  summary: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
}): AgentTask {
  return baseTask('admin', params.description ?? `Schedule calendar event: ${params.summary}`, {
    type: 'schedule_event',
    summary: params.summary,
    start: params.start,
    end: params.end,
    attendees: params.attendees,
    description: params.description,
  });
}

export function createFreeformTask(params: {
  prompt: string;
  description?: string;
  history?: ProviderMessage[];
}): AgentTask {
  return baseTask('admin', params.description ?? params.prompt, {
    type: 'freeform',
    prompt: params.prompt,
    history: params.history,
  });
}

export function createDailyBriefingTask(options?: {
  description?: string;
  maxEmails?: number;
  daysAhead?: number;
}): AgentTask {
  return baseTask('admin', options?.description ?? 'Morning briefing: inbox + calendar.', {
    type: 'daily_briefing',
    maxEmails: options?.maxEmails,
    daysAhead: options?.daysAhead,
  });
}

export function createFollowUpNudgesTask(options?: {
  description?: string;
  daysStale?: number;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Check for sent threads awaiting reply and draft follow-ups.',
    { type: 'follow_up_nudges', daysStale: options?.daysStale }
  );
}

export function createProactiveInsightsTask(options?: { description?: string }): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Reflect on approval/rejection patterns across every agent.',
    { type: 'proactive_insights' }
  );
}

export function createStaleApprovalsTask(options?: {
  description?: string;
  daysStale?: number;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Flag approval requests that have been sitting pending too long.',
    { type: 'stale_approvals_nudge', daysStale: options?.daysStale }
  );
}
