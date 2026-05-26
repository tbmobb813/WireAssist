import { randomUUID } from 'crypto';
import type { AgentTask, AgentRole } from '@synqworks/core';

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
  | { type: 'freeform'; prompt: string };

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
  return baseTask(
    'admin',
    options?.description ?? 'Triage my inbox and propose actions.',
    {
      type: 'email_triage',
      maxEmails: options?.maxEmails,
    }
  );
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
  return baseTask(
    'admin',
    params.description ?? `Schedule calendar event: ${params.summary}`,
    {
      type: 'schedule_event',
      summary: params.summary,
      start: params.start,
      end: params.end,
      attendees: params.attendees,
      description: params.description,
    }
  );
}

export function createFreeformTask(params: { prompt: string; description?: string }): AgentTask {
  return baseTask(
    'admin',
    params.description ?? params.prompt,
    {
      type: 'freeform',
      prompt: params.prompt,
    }
  );
}

