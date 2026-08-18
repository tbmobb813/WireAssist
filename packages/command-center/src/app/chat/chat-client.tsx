'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';

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

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

const ACTIVE_CONVERSATION_KEY = 'wireassist:activeConversationId';

const WELCOME_MESSAGE: Message = {
  id: '0',
  role: 'agent',
  content:
    'WireAssist online. I can triage your inbox, review your calendar, write content, research a topic, run an ops workflow, or just answer a question — what do you need? (GTM strategy requests get pointed to the GTM wizard, which needs more detail than chat can capture.)',
  time: new Date(),
};

function payloadTaskId(payload: unknown): string | undefined {
  const p = payload as { taskId?: string };
  return typeof p?.taskId === 'string' ? p.taskId : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatRelativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// Kept in sync with the server's own cap (packages/command-center/src/api/server.ts) —
// trimming client-side too avoids sending a payload that's just discarded anyway.
const MAX_HISTORY_MESSAGES = 20;

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingTaskId = useRef<string | null>(null);
  const handledEvents = useRef(new Set<string>());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const refreshConversationList = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: ConversationSummary[] };
      setConversationList(data.conversations);
    } catch (err) {
      console.warn('Failed to load conversation list', err);
    }
  }, []);

  const hydrateMessages = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      messages: { id: string; role: string; content: string; timestamp: number }[];
    };
    if (data.messages.length === 0) {
      setMessages([WELCOME_MESSAGE]);
    } else {
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'agent',
          content: m.content,
          time: new Date(m.timestamp),
        }))
      );
    }
    return true;
  }, []);

  // Persistence is additive, never a hard dependency — any failure here
  // just leaves conversationId null and the chat keeps working exactly as
  // it did before this feature existed (ephemeral, in-memory only).
  useEffect(() => {
    (async () => {
      const storedId =
        typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_CONVERSATION_KEY) : null;
      try {
        if (storedId) {
          const hydrated = await hydrateMessages(storedId);
          if (hydrated) {
            setConversationId(storedId);
            void refreshConversationList();
            return;
          }
          // Stored id points at a conversation that no longer exists (deleted
          // from under it) — fall through to creating a fresh one.
        }
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { id: string };
        setConversationId(data.id);
        window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, data.id);
        void refreshConversationList();
      } catch (err) {
        console.warn('Conversation persistence unavailable — chat will not be saved', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchConversation = useCallback(
    async (id: string) => {
      setSwitcherOpen(false);
      if (id === conversationId) return;
      const hydrated = await hydrateMessages(id);
      if (!hydrated) return;
      setConversationId(id);
      window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
      // Abandon UI-side tracking of any in-flight task on the conversation we're
      // leaving — the backend task itself isn't cancelled, same as a page
      // refresh already does today.
      pendingTaskId.current = null;
      setSending(false);
    },
    [conversationId, hydrateMessages]
  );

  const startNewConversation = useCallback(async () => {
    setSwitcherOpen(false);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { id: string };
      setConversationId(data.id);
      window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, data.id);
      setMessages([WELCOME_MESSAGE]);
      pendingTaskId.current = null;
      setSending(false);
      void refreshConversationList();
    } catch (err) {
      console.warn('Failed to start a new conversation', err);
    }
  }, [refreshConversationList]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Failed to delete conversation', err);
      }
      setConversationList((prev) => prev.filter((c) => c.id !== id));
      if (id === conversationId) {
        await startNewConversation();
      }
    },
    [conversationId, startNewConversation]
  );

  const finishSending = useCallback(() => {
    setSending(false);
    pendingTaskId.current = null;
  }, []);

  const addProgressMessage = useCallback((content: string, taskId?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        role: 'agent',
        content,
        time: new Date(),
        taskId,
      },
    ]);
  }, []);

  const addAgentMessage = useCallback(
    (content: string, taskId?: string) => {
      addProgressMessage(content, taskId);
      if (conversationId) {
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content }),
        })
          .then(() => refreshConversationList())
          .catch((err) => console.warn('Failed to persist assistant message', err));
      }
      finishSending();
    },
    [addProgressMessage, finishSending, conversationId, refreshConversationList]
  );

  const markHandled = useCallback((taskId: string, event: string, key?: string) => {
    handledEvents.current.add(`${taskId}:${event}${key ? `:${key}` : ''}`);
  }, []);

  const wasHandled = useCallback((taskId: string, event: string, key?: string) => {
    return handledEvents.current.has(`${taskId}:${event}${key ? `:${key}` : ''}`);
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
            taskId
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
        case 'content_generated': {
          const p = payload as { content?: string; platform?: string };
          addAgentMessage(`Generated ${p.platform} post:\n\n${p.content ?? ''}`, taskId);
          markHandled(taskId, event);
          return true;
        }
        case 'content_plan_generated': {
          const p = payload as { totalGenerated?: number };
          addAgentMessage(
            `Generated a content plan: ${p.totalGenerated ?? 0} posts. Check the Content tab for details.`,
            taskId
          );
          markHandled(taskId, event);
          return true;
        }
        case 'research_complete': {
          const p = payload as { summary?: string; sources?: string[] };
          const sources =
            p.sources && p.sources.length > 0 ? `\n\nSources:\n${p.sources.join('\n')}` : '';
          addAgentMessage(`${p.summary ?? ''}${sources}`, taskId);
          markHandled(taskId, event);
          return true;
        }
        case 'ops_freeform_response': {
          const p = payload as { response?: string };
          addAgentMessage(p.response ?? '', taskId);
          markHandled(taskId, event);
          return true;
        }
        case 'github_freeform_response': {
          const p = payload as { response?: string };
          addAgentMessage(p.response ?? '', taskId);
          markHandled(taskId, event);
          return true;
        }
        case 'ops_stage_complete': {
          const p = payload as { stage?: string };
          const stageKey = p.stage ?? 'unknown';
          // Keyed by stage (not just taskId:event) since this event fires once
          // per stage for the same task — dedupe per-stage instead of per-event.
          if (!wasHandled(taskId, event, stageKey)) {
            addProgressMessage(`Ops: ${p.stage} stage complete...`, taskId);
            markHandled(taskId, event, stageKey);
          }
          // Never terminal, and uses addProgressMessage (not addAgentMessage) so
          // it doesn't reset pendingTaskId — keep listening for the eventual
          // ops_run_complete or ops_blocked event on this taskId.
          return false;
        }
        case 'ops_blocked': {
          const p = payload as { diagnosis?: string };
          addAgentMessage(`Ops workflow blocked: ${p.diagnosis ?? ''}`, taskId);
          markHandled(taskId, event);
          return true;
        }
        case 'ops_run_complete': {
          const p = payload as { workflow?: string; approved?: boolean };
          addAgentMessage(
            `Ops workflow "${p.workflow}" ${p.approved ? 'completed and approved' : 'completed (not approved)'}.`,
            taskId
          );
          markHandled(taskId, event);
          return true;
        }
        default:
          return false;
      }
    },
    [addAgentMessage, addProgressMessage, markHandled, wasHandled]
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
    [applyTaskEvent]
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
              taskId
            );
            return;
          }
        }

        await sleep(1000);
      }

      if (pendingTaskId.current === taskId) {
        addAgentMessage(
          'Timed out waiting for a response. The agent may still be running — check the dashboard.',
          taskId
        );
      }
    },
    [addAgentMessage, scanActivity]
  );

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'connected') return;
        const taskId = payloadTaskId(e.payload);
        if (!taskId || !pendingTaskId.current || taskId !== pendingTaskId.current) return;
        applyTaskEvent(e.event, e.payload, taskId);
      },
      [applyTaskEvent]
    )
  );

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    // Captured before this turn's messages are appended — the transcript
    // so far is exactly the "prior turns" the backend should see for
    // conversational continuity.
    const history = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    setInput('');
    setSending(true);
    pendingTaskId.current = null;

    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        role: 'user',
        content: text,
        time: new Date(),
      },
    ]);

    if (conversationId) {
      fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: text }),
      }).catch((err) => console.warn('Failed to persist user message', err));
    }

    try {
      const res = await fetch('/api/tasks/freeform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: text, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
        addAgentMessage(`Error: ${message}`);
        return;
      }
      if (typeof data.redirect === 'string') {
        addAgentMessage(`${data.message ?? ''}\n\nOpen the GTM wizard: ${data.redirect}`);
        return;
      }
      if (typeof data.taskId === 'string') {
        pendingTaskId.current = data.taskId;
        void pollForTask(data.taskId);
      } else {
        finishSending();
      }
    } catch (err) {
      addAgentMessage(`Error: ${err instanceof Error ? err.message : 'Could not reach the API'}`);
    }
  };

  const activeConversation = conversationList.find((c) => c.id === conversationId);

  return (
    <div className="flex flex-col p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs tracking-widest text-accent mb-1">WIREASSIST // CHAT</div>
          <h1 className="text-2xl font-black">AGENT CHAT</h1>
        </div>

        <div className="relative">
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs max-w-[220px]"
            style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#94a3b8' }}
          >
            <span className="truncate">{activeConversation?.title ?? 'New conversation'}</span>
            <span className="flex-shrink-0">▾</span>
          </button>

          {switcherOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSwitcherOpen(false)} />
              <div
                className="absolute right-0 mt-2 rounded-lg z-20"
                style={{
                  background: '#0f1225',
                  border: '1px solid #1e2040',
                  width: 280,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                <button
                  onClick={startNewConversation}
                  className="w-full text-left px-4 py-3 text-xs font-bold tracking-widest"
                  style={{ color: '#4fc3f7', borderBottom: '1px solid #1e2040' }}
                >
                  + NEW CONVERSATION
                </button>
                {conversationList.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-600">No conversations yet.</div>
                ) : (
                  conversationList.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => switchConversation(c.id)}
                      className="flex items-center justify-between gap-2 px-4 py-3 text-xs cursor-pointer hover:bg-white/5"
                      style={{ background: c.id === conversationId ? '#1e2040' : 'transparent' }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-gray-300">{c.title}</div>
                        <div className="text-gray-600 mt-0.5">
                          {formatRelativeTime(c.updatedAt)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(c.id);
                        }}
                        className="flex-shrink-0 text-gray-600 hover:text-red-400 px-1"
                        title="Delete conversation"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="flex-1 rounded-lg border p-4 overflow-y-auto mb-4 space-y-4"
        style={{ background: '#0d0d1a', borderColor: '#1e2040', minHeight: 400, maxHeight: 600 }}
      >
        {messages.map((msg) => (
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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Write a post, research a topic, run a workflow, ask anything..."
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
