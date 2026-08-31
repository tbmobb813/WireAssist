import { randomUUID } from 'crypto';
import type {
  AgentTask,
  AgentRole,
  ImageAttachment,
  DocumentAttachment,
  ProviderMessage,
} from '@wireassist/core';
import type { ObjectiveHealthCheckCandidate } from './skills/objective-health-check';

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
  | {
      type: 'freeform';
      prompt: string;
      history?: ProviderMessage[];
      images?: ImageAttachment[];
      documents?: DocumentAttachment[];
    }
  | { type: 'daily_briefing'; maxEmails?: number; daysAhead?: number }
  | { type: 'follow_up_nudges'; daysStale?: number }
  | { type: 'proactive_insights' }
  | { type: 'budget_warning_nudge'; thresholdPercent?: number }
  | { type: 'stale_approvals_nudge'; daysStale?: number; backlogThreshold?: number }
  | { type: 'detect_skill_opportunities'; limit?: number }
  | { type: 'meeting_prep'; hoursAhead?: number }
  | {
      type: 'objective_health_check_nudge';
      daysStale?: number;
      objectives: ObjectiveHealthCheckCandidate[];
    }
  | { type: 'travel_itinerary_digest'; daysAhead?: number }
  | { type: 'expense_digest'; daysAgo?: number }
  | { type: 'meeting_followup'; hoursBack?: number }
  | { type: 'draft_document'; brief: string; title?: string };

function baseTask(
  role: AgentRole,
  description: string,
  input: SupportedTaskInput,
  objectiveId?: string
): AgentTask {
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
    objectiveId,
  };
}

export function createEmailTriageTask(options?: {
  description?: string;
  maxEmails?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Triage my inbox and propose actions.',
    { type: 'email_triage', maxEmails: options?.maxEmails },
    options?.objectiveId
  );
}

export function createCalendarReviewTask(options?: {
  description?: string;
  daysAhead?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Review my upcoming calendar and suggest improvements.',
    {
      type: 'calendar_review',
      daysAhead: options?.daysAhead ?? 7,
    },
    options?.objectiveId
  );
}

export function createSendEmailTask(params: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  description?: string;
  objectiveId?: string;
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
    },
    params.objectiveId
  );
}

export function createScheduleEventTask(params: {
  summary: string;
  start: string;
  end: string;
  attendees?: string[];
  description?: string;
  objectiveId?: string;
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
    },
    params.objectiveId
  );
}

export function createFreeformTask(params: {
  prompt: string;
  description?: string;
  history?: ProviderMessage[];
  images?: ImageAttachment[];
  documents?: DocumentAttachment[];
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    params.description ?? params.prompt,
    {
      type: 'freeform',
      prompt: params.prompt,
      history: params.history,
      images: params.images,
      documents: params.documents,
    },
    params.objectiveId
  );
}

export function createDailyBriefingTask(options?: {
  description?: string;
  maxEmails?: number;
  daysAhead?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Morning briefing: inbox + calendar.',
    {
      type: 'daily_briefing',
      maxEmails: options?.maxEmails,
      daysAhead: options?.daysAhead,
    },
    options?.objectiveId
  );
}

export function createFollowUpNudgesTask(options?: {
  description?: string;
  daysStale?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Check for sent threads awaiting reply and draft follow-ups.',
    { type: 'follow_up_nudges', daysStale: options?.daysStale },
    options?.objectiveId
  );
}

export function createProactiveInsightsTask(options?: {
  description?: string;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Reflect on approval/rejection patterns across every agent.',
    { type: 'proactive_insights' },
    options?.objectiveId
  );
}

export function createBudgetWarningTask(options?: {
  description?: string;
  thresholdPercent?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Check month-to-date spend against the budget warning threshold.',
    { type: 'budget_warning_nudge', thresholdPercent: options?.thresholdPercent },
    options?.objectiveId
  );
}

export function createStaleApprovalsTask(options?: {
  description?: string;
  daysStale?: number;
  backlogThreshold?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ??
      'Flag approval requests that are stuck pending, piled up past a count threshold, or ' +
        'approved but never run.',
    {
      type: 'stale_approvals_nudge',
      daysStale: options?.daysStale,
      backlogThreshold: options?.backlogThreshold,
    },
    options?.objectiveId
  );
}

export function createDetectSkillOpportunitiesTask(options?: {
  description?: string;
  limit?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Look for a repeated pattern in recent freeform requests.',
    { type: 'detect_skill_opportunities', limit: options?.limit },
    options?.objectiveId
  );
}

export function createMeetingPrepTask(options?: {
  description?: string;
  hoursAhead?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Draft prep notes for meetings starting soon.',
    { type: 'meeting_prep', hoursAhead: options?.hoursAhead },
    options?.objectiveId
  );
}

export function createObjectiveHealthCheckTask(options: {
  objectives: ObjectiveHealthCheckCandidate[];
  description?: string;
  daysStale?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options.description ?? 'Flag active Objectives that have gone quiet.',
    {
      type: 'objective_health_check_nudge',
      daysStale: options.daysStale,
      objectives: options.objectives,
    },
    options.objectiveId
  );
}

export function createTravelItineraryTask(options?: {
  description?: string;
  daysAhead?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Compile an upcoming travel itinerary digest.',
    { type: 'travel_itinerary_digest', daysAhead: options?.daysAhead },
    options?.objectiveId
  );
}

export function createExpenseDigestTask(options?: {
  description?: string;
  daysAgo?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Summarize recent receipts and invoices by category.',
    { type: 'expense_digest', daysAgo: options?.daysAgo },
    options?.objectiveId
  );
}

export function createMeetingFollowupTask(options?: {
  description?: string;
  hoursBack?: number;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    options?.description ?? 'Draft follow-ups for meetings that just ended.',
    { type: 'meeting_followup', hoursBack: options?.hoursBack },
    options?.objectiveId
  );
}

export function createDraftDocumentTask(params: {
  brief: string;
  title?: string;
  description?: string;
  objectiveId?: string;
}): AgentTask {
  return baseTask(
    'admin',
    params.description ?? `Draft a document: ${params.title ?? params.brief.slice(0, 60)}`,
    { type: 'draft_document', brief: params.brief, title: params.title },
    params.objectiveId
  );
}
