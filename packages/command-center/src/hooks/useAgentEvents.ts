'use client';
import { useEffect, useCallback, useRef } from 'react';

export type AgentEvent =
  | { event: 'connected' }
  | { event: 'task_started'; payload: { agentRole: string; taskId: string; description: string } }
  | { event: 'task_complete'; payload: { agentRole: string; taskId: string } }
  | { event: 'task_failed'; payload: { agentRole: string; taskId: string; error: string } }
  | { event: 'waiting_approval'; payload: { agentRole: string; taskId: string; action: string } }
  | { event: 'approval_resolved'; payload: { id?: string; agentRole?: string; approved: boolean } }
  | { event: 'triage_complete'; payload: unknown }
  | { event: 'calendar_review_complete'; payload: unknown }
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
  | { event: 'auto_approved'; payload: { agentRole: string; taskId: string; action: string } }
  | {
      event: 'handoff_queued';
      payload: { task: { id: string; agentRole: string; description: string } };
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
