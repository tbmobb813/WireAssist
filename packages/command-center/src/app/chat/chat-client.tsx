'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { ObjectivePicker, useActiveObjectives } from '../objective-picker';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  time: Date;
  taskId?: string;
  // Client-side/in-memory only — never persisted (conversation history stays
  // text-only), so attachments don't survive a page reload or conversation
  // switch. See PendingImage/PendingDocument below for the shape before
  // it's sent.
  attachments?: { previewUrl?: string; filename?: string }[];
  // Client-side only, like attachments — rendered as a collapsible list
  // rather than inline text. Lost on reload same as attachments (persisted
  // history stores sources as plain trailing text instead, so nothing is
  // lost, just the interactive collapse).
  sources?: string[];
}

interface PendingImage {
  mediaType: string;
  data: string; // raw base64, no `data:` URI prefix — what the API expects
  previewUrl: string; // full `data:` URI — what <img src> needs
}

interface PendingDocument {
  mediaType: 'application/pdf' | 'text/plain';
  data: string; // raw base64, no `data:` URI prefix — what the API expects
  filename: string; // no thumbnail preview possible — shown as a chip instead
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

interface MessageSearchResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  role: string;
  content: string;
  timestamp: number;
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

// 1 poll/sec, so this is also the wall-clock ceiling in seconds. Was 120s
// (2 min) — too tight for a multi-step freeform loop (up to 12 tool-call
// iterations, several of which — research_topic_skill, synthesize_findings_skill
// — are themselves a full search-then-LLM-synthesis round trip), which can
// legitimately run past 2 minutes without anything being wrong. Task
// processing itself has no request-bound timeout (it's a separate worker,
// not tied to any HTTP lifecycle) — this is purely how long the UI stays
// patient, so raising it costs nothing but a few more lightweight polls.
const MAX_POLL_SECONDS = 300;

// Curated phrasing for the tools/skills a user is most likely to actually
// watch happen live. Anything not listed here still gets a readable message
// via humanizeToolName() below — this is polish for the common cases, not
// a hard requirement for every current or future tool name to appear here.
const TOOL_CALL_LABELS: Record<string, string> = {
  delegate_to_agent: 'Considering a hand-off to another agent...',
  brave_search: 'Searching the web...',
  fetch_product_price: 'Checking the live price on that page...',
  research_topic_skill: 'Researching...',
  research_and_synthesize_skill: 'Researching and pulling in what I already know...',
  synthesize_findings_skill: 'Pulling together what I already know...',
  email_triage_skill: 'Triaging your inbox...',
  calendar_review_skill: 'Reviewing your calendar...',
  generate_post_skill: 'Drafting the post...',
  generate_plan_skill: 'Drafting a content plan...',
  run_workflow_skill: 'Running the ops workflow...',
  propose_skill_skill: 'Drafting a new skill for this...',
};

// snake_case fallback -> "Snake case..." for anything not in the curated
// map above — never silently drops the message, just less polished.
function humanizeToolName(toolName: string): string {
  const spaced = toolName.replace(/_/g, ' ').trim();
  const sentence = spaced.charAt(0).toUpperCase() + spaced.slice(1);
  return `${sentence}...`;
}

function toolCallLabel(toolName: string): string {
  return TOOL_CALL_LABELS[toolName] ?? humanizeToolName(toolName);
}

// Mirrors ROLE_LABELS in packages/agents/admin/src/delegate.ts — kept as a
// small local copy rather than a cross-package import since this is purely
// display text, not shared logic. 'strategy' really is NixOps's internal
// role name, not a display bug.
const AGENT_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  content: 'Content',
  research: 'Research',
  strategy: 'NixOps',
  gtm: 'GTM',
  github: 'GitHub Dev',
};

function agentRoleLabel(role: string): string {
  return AGENT_ROLE_LABELS[role] ?? role;
}

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

// Kept in sync with sanitizeImages()'s caps in server.ts. The raw-file cap is
// set below the server's 9 MB base64 cap to leave headroom for base64's ~33%
// size overhead, so a file that passes this check never gets rejected server-side.
const MAX_IMAGES = 4;
const MAX_IMAGE_FILE_BYTES = 6 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Same idea as the image caps above, kept in sync with sanitizeDocuments()'s
// caps in server.ts (30 MB base64 cap there) — PDF and plain text only, both
// natively readable by Claude's API with no extraction step.
const MAX_DOCUMENTS = 4;
const MAX_DOCUMENT_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = new Set(['application/pdf', 'text/plain']);

function readImageFile(file: File): Promise<PendingImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const previewUrl = reader.result as string;
      const data = previewUrl.slice(previewUrl.indexOf(',') + 1);
      resolve({ mediaType: file.type, data, previewUrl });
    };
    reader.readAsDataURL(file);
  });
}

function readDocumentFile(file: File): Promise<PendingDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      resolve({
        mediaType: file.type as 'application/pdf' | 'text/plain',
        data,
        filename: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [objectiveId, setObjectiveId] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const objectives = useActiveObjectives();
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingTaskId = useRef<string | null>(null);
  const handledEvents = useRef(new Set<string>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // pollForTask is declared further down (it depends on scanActivity, which
  // depends on applyTaskEvent) — applyTaskEvent needing to call it back
  // (to redirect polling on a 'chat_dispatch_queued' event) is a genuine
  // mutual dependency, not just a declaration-order accident. A ref
  // indirection breaks the cycle: applyTaskEvent calls
  // pollForTaskRef.current, kept in sync below once pollForTask exists.
  const pollForTaskRef = useRef<((taskId: string) => Promise<void>) | null>(null);

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

  // Debounced so switching in the search box doesn't fire one request per
  // keystroke — 300ms is short enough to feel live, long enough to skip
  // every intermediate character while typing at normal speed.
  useEffect(() => {
    const query = conversationSearch.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { results: MessageSearchResult[] };
        setSearchResults(data.results);
      } catch (err) {
        console.warn('Conversation search failed', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [conversationSearch]);

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
      setConversationSearch('');
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
      setObjectiveId('');
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

  const addProgressMessage = useCallback((content: string, taskId?: string, sources?: string[]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        role: 'agent',
        content,
        time: new Date(),
        taskId,
        sources,
      },
    ]);
  }, []);

  const addAgentMessage = useCallback(
    (content: string, taskId?: string, sources?: string[]) => {
      addProgressMessage(content, taskId, sources);
      if (conversationId) {
        // Persisted history is plain text (same tradeoff as attachments,
        // which also don't survive reload) — fold sources back in as
        // trailing text so a reloaded conversation doesn't lose them
        // outright, just the interactive collapse.
        const persistedContent =
          sources && sources.length > 0 ? `${content}\n\nSources:\n${sources.join('\n')}` : content;
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content: persistedContent }),
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
          addAgentMessage(p.summary ?? '', taskId, p.sources);
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
        case 'tool_call_started': {
          const p = payload as { toolCallId?: string; toolName?: string };
          const key = p.toolCallId ?? p.toolName ?? 'unknown';
          // Keyed by toolCallId (not just taskId:event) — the same tool can
          // legitimately be called more than once across a multi-iteration
          // loop, and each call is its own distinct progress line.
          if (!wasHandled(taskId, event, key) && p.toolName) {
            addProgressMessage(toolCallLabel(p.toolName), taskId);
            markHandled(taskId, event, key);
          }
          // Never terminal — purely a progress line, the real answer arrives
          // on a later event (freeform_response, research_complete, etc.).
          return false;
        }
        case 'handoff_queued': {
          const p = payload as { task?: { agentRole?: string } };
          const role = p.task?.agentRole;
          if (role) {
            addProgressMessage(`Handing off to the ${agentRoleLabel(role)} agent...`, taskId);
          }
          markHandled(taskId, event);
          // Not terminal for THIS agent's turn — the delegated task runs
          // separately (its own tab/Approvals), but the originating
          // freeform_response for this turn (the tool_result summarizing
          // the handoff) still arrives on this same taskId.
          return false;
        }
        case 'chat_dispatch_queued': {
          // Admin dispatched a specific action (write a post, run research,
          // etc.) via one of chat-dispatch.ts's zero-approval tools — the
          // real result will arrive tagged with the NEW task's id, not the
          // one this request started with, so redirect tracking to it or
          // it'll never match and the chat window will just go quiet.
          const p = payload as { dispatchedTaskId?: string; agentRole?: string };
          if (p.dispatchedTaskId) {
            addProgressMessage(
              `Handing off to the ${agentRoleLabel(p.agentRole ?? '')} agent...`,
              taskId
            );
            markHandled(taskId, event);
            pendingTaskId.current = p.dispatchedTaskId;
            void pollForTaskRef.current?.(p.dispatchedTaskId);
          }
          return false; // non-terminal — the real completion event now matches the redirected id
        }
        case 'gtm_redirect_requested': {
          // Admin's redirect_to_gtm_wizard tool — no task was ever queued
          // for this one, so just show the message+link directly.
          const p = payload as { redirect?: string; message?: string };
          addAgentMessage(
            `${p.message ?? ''}\n\nOpen the GTM wizard: ${p.redirect ?? '/gtm'}`,
            taskId
          );
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
      for (let i = 0; i < MAX_POLL_SECONDS; i++) {
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

  useEffect(() => {
    pollForTaskRef.current = pollForTask;
  }, [pollForTask]);

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

  const addImageFiles = useCallback(
    async (files: File[]) => {
      setImageError(null);
      const room = MAX_IMAGES - pendingImages.length;
      if (room <= 0) {
        setImageError(`You can attach up to ${MAX_IMAGES} images.`);
        return;
      }
      const accepted: File[] = [];
      let rejectedType = false;
      let rejectedSize = false;
      for (const file of files.slice(0, room)) {
        if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
          rejectedType = true;
          continue;
        }
        if (file.size > MAX_IMAGE_FILE_BYTES) {
          rejectedSize = true;
          continue;
        }
        accepted.push(file);
      }
      if (files.length > room) {
        setImageError(`Only ${room} more image(s) can be attached (max ${MAX_IMAGES}).`);
      } else if (rejectedSize) {
        setImageError('One or more images were too large (max 6 MB each) and were skipped.');
      } else if (rejectedType) {
        setImageError('Only JPEG, PNG, GIF, and WebP images are supported.');
      }
      if (accepted.length === 0) return;
      try {
        const read = await Promise.all(accepted.map(readImageFile));
        setPendingImages((prev) => [...prev, ...read]);
      } catch (err) {
        setImageError(err instanceof Error ? err.message : 'Failed to read image file');
      }
    },
    [pendingImages.length]
  );

  const removePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addDocumentFiles = useCallback(
    async (files: File[]) => {
      setDocumentError(null);
      const room = MAX_DOCUMENTS - pendingDocuments.length;
      if (room <= 0) {
        setDocumentError(`You can attach up to ${MAX_DOCUMENTS} files.`);
        return;
      }
      const accepted: File[] = [];
      let rejectedSize = false;
      for (const file of files.slice(0, room)) {
        if (file.size > MAX_DOCUMENT_FILE_BYTES) {
          rejectedSize = true;
          continue;
        }
        accepted.push(file);
      }
      if (files.length > room) {
        setDocumentError(`Only ${room} more file(s) can be attached (max ${MAX_DOCUMENTS}).`);
      } else if (rejectedSize) {
        setDocumentError('One or more files were too large (max 20 MB each) and were skipped.');
      }
      if (accepted.length === 0) return;
      try {
        const read = await Promise.all(accepted.map(readDocumentFile));
        setPendingDocuments((prev) => [...prev, ...read]);
      } catch (err) {
        setDocumentError(err instanceof Error ? err.message : 'Failed to read file');
      }
    },
    [pendingDocuments.length]
  );

  const removePendingDocument = useCallback((index: number) => {
    setPendingDocuments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Single "attach" affordance covers both images and documents — split the
  // browser's file selection by MIME type and route each to its own reader.
  // Anything matching neither gets one combined rejection message instead
  // of a confusing per-type error.
  const addFiles = useCallback(
    (files: File[]) => {
      const imageFiles = files.filter((f) => ACCEPTED_IMAGE_TYPES.has(f.type));
      const documentFiles = files.filter((f) => ACCEPTED_DOCUMENT_TYPES.has(f.type));
      const unsupported = files.length - imageFiles.length - documentFiles.length;
      if (imageFiles.length > 0) void addImageFiles(imageFiles);
      if (documentFiles.length > 0) void addDocumentFiles(documentFiles);
      if (unsupported > 0) {
        setDocumentError(
          `${unsupported} file(s) skipped — only JPEG/PNG/GIF/WebP images and PDF/plain text files are supported.`
        );
      }
    },
    [addImageFiles, addDocumentFiles]
  );

  const send = async () => {
    if ((!input.trim() && pendingImages.length === 0 && pendingDocuments.length === 0) || sending)
      return;
    // A caption isn't required when at least one attachment is present — the
    // route requires non-empty `instruction`, so fall back to a sensible
    // default rather than blocking an attachment-only send.
    const text = input.trim() || 'Describe the attached file(s).';
    const images = pendingImages;
    const documents = pendingDocuments;
    // Captured before this turn's messages are appended — the transcript
    // so far is exactly the "prior turns" the backend should see for
    // conversational continuity.
    const history = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    setInput('');
    setPendingImages([]);
    setImageError(null);
    setPendingDocuments([]);
    setDocumentError(null);
    setSending(true);
    pendingTaskId.current = null;

    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        role: 'user',
        content: text,
        time: new Date(),
        attachments:
          images.length || documents.length
            ? [
                ...images.map(({ previewUrl }) => ({ previewUrl })),
                ...documents.map(({ filename }) => ({ filename })),
              ]
            : undefined,
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
        body: JSON.stringify({
          instruction: text,
          history,
          objectiveId: objectiveId || undefined,
          images: images.length
            ? images.map(({ mediaType, data }) => ({ mediaType, data }))
            : undefined,
          documents: documents.length
            ? documents.map(({ mediaType, data, filename }) => ({ mediaType, data, filename }))
            : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
        addAgentMessage(`Error: ${message}`);
        return;
      }
      if (typeof data.taskId === 'string') {
        // Admin's task queue is fully serialized — this message is queued
        // and WILL run once the blocking approval is resolved, but without
        // this it just looks like the request silently vanished for
        // however long that approval sits unresolved.
        if (data.blockedByApproval?.action) {
          addProgressMessage(
            `Heads up: still waiting on your approval for "${data.blockedByApproval.action}" — resolve that in Approvals and this message will continue automatically.`,
            data.taskId
          );
        }
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
              <div
                className="fixed inset-0 z-10"
                onClick={() => {
                  setSwitcherOpen(false);
                  setConversationSearch('');
                }}
              />
              <div
                className="absolute right-0 mt-2 rounded-lg z-20"
                style={{
                  background: '#0f1225',
                  border: '1px solid #1e2040',
                  width: 280,
                  maxHeight: 400,
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
                <div className="px-3 py-2" style={{ borderBottom: '1px solid #1e2040' }}>
                  <input
                    autoFocus
                    value={conversationSearch}
                    onChange={(e) => setConversationSearch(e.target.value)}
                    placeholder="Search past conversations..."
                    className="w-full rounded px-2 py-1.5 text-xs outline-none"
                    style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#e2e8f0' }}
                  />
                </div>
                {conversationSearch.trim() ? (
                  searching ? (
                    <div className="px-4 py-3 text-xs text-gray-600">Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-600">No messages found.</div>
                  ) : (
                    searchResults.map((r) => (
                      <div
                        key={r.messageId}
                        onClick={() => switchConversation(r.conversationId)}
                        className="px-4 py-3 text-xs cursor-pointer hover:bg-white/5"
                        style={{
                          background:
                            r.conversationId === conversationId ? '#1e2040' : 'transparent',
                          borderBottom: '1px solid #1e2040',
                        }}
                      >
                        <div className="truncate text-gray-300 font-medium">
                          {r.conversationTitle}
                        </div>
                        <div className="truncate text-gray-500 mt-0.5">
                          {r.role === 'user' ? 'You: ' : 'Agent: '}
                          {r.content}
                        </div>
                        <div className="text-gray-600 mt-0.5">
                          {formatRelativeTime(r.timestamp)}
                        </div>
                      </div>
                    ))
                  )
                ) : conversationList.length === 0 ? (
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

      <div className="mb-2">
        <label className="block text-xs text-gray-500 mb-1">
          Tie this conversation to an objective (optional) — links every agent task it produces,
          including any handoffs, to that objective's board.
        </label>
        <ObjectivePicker objectives={objectives} value={objectiveId} onChange={setObjectiveId} />
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
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.attachments.map((a, i) =>
                    a.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={a.previewUrl}
                        alt="Attached"
                        className="rounded"
                        style={{ width: 160, height: 160, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        key={i}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs"
                        style={{ background: '#1e2040', border: '1px solid #2d3060' }}
                      >
                        📄 {a.filename}
                      </div>
                    )
                  )}
                </div>
              )}
              {msg.content}
              {msg.sources && msg.sources.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer select-none" style={{ color: '#4fc3f7' }}>
                    {msg.sources.length} source{msg.sources.length === 1 ? '' : 's'}
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-4" style={{ color: '#8890b5' }}>
                    {msg.sources.map((s, i) => (
                      <li key={i} className="break-all">
                        <a
                          href={s}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#4fc3f7' }}
                        >
                          {s}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
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

      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt="Pending attachment"
                className="rounded"
                style={{ width: 64, height: 64, objectFit: 'cover' }}
              />
              <button
                onClick={() => removePendingImage(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                style={{ background: '#1e2040', border: '1px solid #2d3060', color: '#e2e8f0' }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {imageError && <div className="mb-2 text-xs text-red-400">{imageError}</div>}
      {pendingDocuments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pendingDocuments.map((doc, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs"
              style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#94a3b8' }}
            >
              📄 {doc.filename}
              <button
                onClick={() => removePendingDocument(i)}
                className="ml-1 w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{ background: '#1e2040', border: '1px solid #2d3060', color: '#e2e8f0' }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {documentError && <div className="mb-2 text-xs text-red-400">{documentError}</div>}

      <div className="flex gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOCUMENT_TYPES].join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={
            sending ||
            (pendingImages.length >= MAX_IMAGES && pendingDocuments.length >= MAX_DOCUMENTS)
          }
          title="Attach photo or file (PDF, text)"
          className="px-4 py-3 rounded-lg text-sm transition-colors"
          style={{
            background: '#0d0d1a',
            border: '1px solid #1e2040',
            color:
              pendingImages.length >= MAX_IMAGES && pendingDocuments.length >= MAX_DOCUMENTS
                ? '#475569'
                : '#94a3b8',
          }}
        >
          📎
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.items)
              .filter((item) => item.kind === 'file')
              .map((item) => item.getAsFile())
              .filter((f): f is File => f !== null);
            if (files.length > 0) addFiles(files);
          }}
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
          disabled={
            sending ||
            (!input.trim() && pendingImages.length === 0 && pendingDocuments.length === 0)
          }
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
