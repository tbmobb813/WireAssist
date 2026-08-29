'use client';
import { useEffect, useCallback, useRef } from 'react';

export type AgentEvent =
  | { event: 'connected' }
  | {
      event: 'task_queued';
      payload: { agentRole: string; taskId: string; description: string; objectiveId?: string };
    }
  | {
      event: 'task_started';
      payload: { agentRole: string; taskId: string; description: string; objectiveId?: string };
    }
  | { event: 'task_complete'; payload: { agentRole: string; taskId: string; objectiveId?: string } }
  | {
      event: 'task_failed';
      payload: { agentRole: string; taskId: string; error: string; objectiveId?: string };
    }
  | {
      event: 'waiting_approval';
      payload: { agentRole: string; taskId: string; action: string; objectiveId?: string };
    }
  | {
      event: 'approval_resolved';
      payload: { id?: string; agentRole?: string; approved: boolean; objectiveId?: string };
    }
  | {
      event: 'triage_complete';
      payload: {
        taskId: string;
        summary: string;
        categories: {
          urgent: { threadId: string; from: string; subject: string; reason: string }[];
          replyNeeded: { threadId: string; from: string; subject: string; draftReply: string }[];
          fyi: { threadId: string; from: string; subject: string }[];
          ignore: { threadId: string; from: string; reason: string }[];
        };
      };
    }
  | {
      event: 'calendar_review_complete';
      payload: {
        taskId: string;
        events: unknown[];
        review: {
          summary: string;
          conflicts: { event1: string; event2: string; overlap: string }[];
          overloadedDays: { date: string; eventCount: number; recommendation: string }[];
          suggestions: { type: string; description: string; action: string }[];
        };
      };
    }
  | {
      event: 'meeting_prep_complete';
      payload: {
        taskId: string;
        summary: string;
        prepared: { eventId: string; summary: string; prep: string }[];
      };
    }
  | {
      event: 'meeting_followup_complete';
      payload: {
        taskId: string;
        summary: string;
        followedUp: { eventId: string; summary: string; followup: string }[];
      };
    }
  | {
      event: 'objective_health_check_complete';
      payload: {
        taskId: string;
        summary: string;
        stale: { id: string; title: string; daysSinceActivity: number | null }[];
      };
    }
  | {
      event: 'travel_itinerary_digest_complete';
      payload: { taskId: string; summary: string; hasTravel: boolean };
    }
  | {
      event: 'expense_digest_complete';
      payload: { taskId: string; summary: string; hasExpenses: boolean };
    }
  | {
      event: 'draft_document_complete';
      payload: { taskId: string; title: string; webViewLink: string };
    }
  | { event: 'freeform_response'; payload: { taskId: string; response: string } }
  | {
      event: 'content_generated';
      payload: { taskId: string; content: string; platform: string; topic: string };
    }
  | { event: 'content_approved'; payload: { taskId: string; content: string; platform: string } }
  | {
      event: 'content_plan_generated';
      payload: { taskId: string; ideas: unknown[]; totalGenerated: number };
    }
  | { event: 'post_scheduled'; payload: { taskId: string; post: unknown } }
  | {
      event: 'content_analyzed';
      payload: { taskId: string; content: string; platform: string; analysis: unknown };
    }
  | { event: 'scheduled_posts'; payload: { taskId: string; posts: unknown[] } }
  | { event: 'gtm_generated'; payload: { taskId: string; gtm: unknown } }
  | { event: 'gtm_psych_generated'; payload: { taskId: string; psych: unknown } }
  | {
      event: 'research_complete';
      payload: { agentRole: string; taskId: string; summary: string; sources?: string[] };
    }
  | {
      event: 'ops_stage_complete';
      payload: {
        agentRole: string;
        taskId: string;
        stage: 'diagnose' | 'assemble' | 'take_action' | 'assess';
      };
    }
  | { event: 'ops_blocked'; payload: { agentRole: string; taskId: string; diagnosis: string } }
  | {
      event: 'ops_run_complete';
      payload: {
        agentRole: string;
        taskId: string;
        workflow: string;
        approved: boolean;
        autoApproved: boolean;
        transcript: string;
      };
    }
  | {
      event: 'ops_freeform_response';
      payload: { agentRole: string; taskId: string; response: string };
    }
  | {
      event: 'github_freeform_response';
      payload: { taskId: string; response: string };
    }
  | {
      event: 'daily_briefing_complete';
      payload: { taskId: string; summary: string; triageSummary: string; calendarSummary: string };
    }
  | {
      event: 'follow_up_nudges_complete';
      payload: {
        taskId: string;
        staleThreads: {
          threadId: string;
          from: string;
          subject: string;
          daysSinceLastMessage: number;
        }[];
      };
    }
  | {
      event: 'proactive_insights_complete';
      payload: {
        taskId: string;
        summary: string;
        findings: {
          agentRole: string;
          action: string;
          streak: 'rejected' | 'approved';
          count: number;
        }[];
      };
    }
  | {
      event: 'trust_graduation_nudges_complete';
      payload: {
        taskId: string;
        summary: string;
        candidates: { workflow: string; streak: number; approved: boolean }[];
      };
    }
  | {
      event: 'budget_warning_complete';
      payload: {
        taskId: string;
        warranted: boolean;
        summary: string;
        spent: number;
        budget: number;
        percent: number;
        resetsAt: string;
      };
    }
  | {
      event: 'stale_approvals_complete';
      payload: {
        taskId: string;
        summary: string;
        stale: { id: string; agentRole: string; action: string; daysPending: number }[];
      };
    }
  | {
      event: 'publish_due_posts_complete';
      payload: {
        taskId: string;
        summary: string;
        published: { id: string; platform: string; platformPostId?: string }[];
        failed: { id: string; platform: string; errorMessage?: string }[];
      };
    }
  | { event: 'auto_approved'; payload: { agentRole: string; taskId: string; action: string } }
  | {
      event: 'handoff_queued';
      // taskId is the ORIGINATING task, not task.id (the new delegated task) —
      // that's what the UI is actually waiting on.
      payload: { task: { id: string; agentRole: string; description: string }; taskId: string };
    }
  | {
      event: 'tool_call_started';
      payload: { taskId: string; toolCallId: string; toolName: string };
    }
  | {
      event: 'manual_card_created';
      payload: { objectiveId: string; cardId: string; text: string; column: string };
    }
  | {
      event: 'manual_card_moved';
      payload: { objectiveId: string; cardId: string; to: string };
    };

export function useAgentEvents(onEvent: (e: AgentEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as AgentEvent;
        handlerRef.current(parsed);
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      // Browser auto-reconnects SSE — no manual handling needed
    };

    return () => es.close();
  }, []);
}
