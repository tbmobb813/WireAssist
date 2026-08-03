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
      payload: { agentRole: string; taskId: string; workflow: string; approved: boolean };
    }
  | {
      event: 'ops_freeform_response';
      payload: { agentRole: string; taskId: string; response: string };
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
