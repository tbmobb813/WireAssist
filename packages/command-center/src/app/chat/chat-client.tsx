'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  time: Date;
  taskId?: string;
}

interface ActivityRecord {
  event: string;
  payload: unknown;
  at: string;
}

function payloadTaskId(payload: unknown): string | undefined {
  const p = payload as { taskId?: string };
  return typeof p?.taskId === 'string' ? p.taskId : undefined;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'agent',
    content: "Admin Agent online. I can triage your inbox, review your calendar, draft emails, or schedule events. What do you need?",
    time: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingTaskId = useRef<string | null>(null);
  const handledEvents = useRef(new Set<string>());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const finishSending = useCallback(() => {
    setSending(false);
    pendingTaskId.current = null;
  }, []);

  const addAgentMessage = useCallback((content: string, taskId?: string) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      role: 'agent',
      content,
      time: new Date(),
      taskId,
    }]);
    finishSending();
  }, [finishSending]);

  const markHandled = useCallback((taskId: string, event: string) => {
    handledEvents.current.add(`${taskId}:${event}`);
  }, []);

  const wasHandled = useCallback((taskId: string, event: string) => {
    return handledEvents.current.has(`${taskId}:${event}`);
  }, []);

  const applyTaskEvent = useCallback(
    (event: string, payload: unknown, taskId: string): boolean => {
      if (wasHandled(taskId, event)) return true;

      switch (event) {
        case 'freeform_response': {
          const p = payload as { response?: string };
          const text = typeof p.response === 'string' ? p.response.trim() : '';
          addAgentMessage(text || '(No response text returned.)', taskId);
          markHandled(taskId, event);
          return true;
        }
        case 'task_failed': {
          const p = payload as { error?: string };
          addAgentMessage(`Error: ${p.error ?? 'Task failed'}`, taskId);
          markHandled(taskId, event);
          return true;
        }
        case 'triage_complete': {
          const p = payload as { summary?: string; totalEmails?: number };
          addAgentMessage(
            `Triage complete. ${p.summary ?? ''}\n\nProcessed ${p.totalEmails ?? 0} emails. Check the Approvals tab for proposed actions.`,
            taskId,
          );
          markHandled(taskId, event);
          return true;
        }
        case 'calendar_review_complete': {
          const p = payload as { review?: { summary?: string } };
          addAgentMessage(`Calendar review done. ${p.review?.summary ?? ''}`, taskId);
          markHandled(taskId, event);
          return true;
        }
        default:
          return false;
      }
    },
    [addAgentMessage, markHandled, wasHandled],
  );

  const scanActivity = useCallback(
    async (taskId: string): Promise<'resolved' | 'complete' | 'pending'> => {
      const res = await fetch(`/api/activity?taskId=${encodeURIComponent(taskId)}`);
      if (!res.ok) return 'pending';
      const records = (await res.json()) as ActivityRecord[];
      let sawComplete = false;

      for (const record of records) {
        if (record.event === 'task_complete') sawComplete = true;
        if (applyTaskEvent(record.event, record.payload, taskId)) {
          return 'resolved';
        }
      }

      return sawComplete ? 'complete' : 'pending';
    },
    [applyTaskEvent],
  );

  const pollForTask = useCallback(
    async (taskId: string) => {
      let completePolls = 0;
      for (let i = 0; i < 120; i++) {
        if (pendingTaskId.current !== taskId) return;

        const status = await scanActivity(taskId);
        if (status === 'resolved') return;

        if (status === 'complete') {
          completePolls += 1;
          if (completePolls >= 3) {
            addAgentMessage(
              'The agent finished but the UI did not receive the reply. Refresh and try again, or check the dashboard activity feed.',
              taskId,
            );
            return;
          }
        }

        await sleep(1000);
      }

      if (pendingTaskId.current === taskId) {
        addAgentMessage('Timed out waiting for a response. The agent may still be running — check the dashboard.', taskId);
      }
    },
    [addAgentMessage, scanActivity],
  );

  useAgentEvents(useCallback((e) => {
    const taskId = payloadTaskId(e.payload);
    if (!taskId || !pendingTaskId.current || taskId !== pendingTaskId.current) return;
    applyTaskEvent(e.event, e.payload, taskId);
  }, [applyTaskEvent]));

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    pendingTaskId.current = null;

    setMessages(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: text,
      time: new Date(),
    }]);

    const lower = text.toLowerCase();
    let path = '/api/tasks/freeform';
    let body: string | undefined = JSON.stringify({ instruction: text });

    if (/\b(triage|inbox)\b/.test(lower) && /\b(email|inbox|mail)\b/.test(lower)) {
      path = '/api/tasks/triage-email';
      body = undefined;
    } else if (/\b(review|check)\b/.test(lower) && /\b(calendar|schedule|meeting)\b/.test(lower)) {
      path = '/api/tasks/review-calendar';
      body = undefined;
    }

    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
        addAgentMessage(`Error: ${message}`);
        return;
      }
      if (typeof data.taskId === 'string') {
        pendingTaskId.current = data.taskId;
        void pollForTask(data.taskId);
      } else {
        finishSending();
      }
    } catch (err) {
      addAgentMessage(
        `Error: ${err instanceof Error ? err.message : 'Could not reach the API'}`,
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-8">
      <div className="mb-6">
        <Link href="/" className="text-xs text-gray-600 hover:text-accent tracking-widest">
          ← COMMAND CENTER
        </Link>
      </div>

      <div className="mb-6">
        <div className="text-xs tracking-widest text-accent mb-1">SYNQWORKS // CHAT</div>
        <h1 className="text-2xl font-black">ADMIN AGENT</h1>
      </div>

      <div
        className="flex-1 rounded-lg border p-4 overflow-y-auto mb-4 space-y-4"
        style={{ background: '#0d0d1a', borderColor: '#1e2040', minHeight: 400, maxHeight: 600 }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'agent' && (
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: '#4fc3f720', border: '1px solid #4fc3f740', color: '#4fc3f7' }}
              >
                A
              </div>
            )}
            <div
              className="max-w-lg rounded-lg px-4 py-3 text-sm"
              style={{
                background: msg.role === 'user' ? '#1e2040' : '#0f1225',
                border: `1px solid ${msg.role === 'user' ? '#2d3060' : '#1e2040'}`,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div
              className="w-7 h-7 rounded flex items-center justify-center text-xs flex-shrink-0"
              style={{ background: '#4fc3f720', border: '1px solid #4fc3f740', color: '#4fc3f7' }}
            >
              A
            </div>
            <div
              className="rounded-lg px-4 py-3 text-sm text-gray-500"
              style={{ background: '#0f1225', border: '1px solid #1e2040' }}
            >
              thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Triage my inbox / Review calendar / Ask anything..."
          className="flex-1 rounded-lg px-4 py-3 text-sm outline-none"
          style={{
            background: '#0d0d1a',
            border: '1px solid #1e2040',
            color: '#e2e8f0',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-colors"
          style={{
            background: sending ? '#1e2040' : '#4fc3f720',
            border: `1px solid ${sending ? '#1e2040' : '#4fc3f740'}`,
            color: sending ? '#475569' : '#4fc3f7',
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
