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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'agent',
    content: "Admin Agent online. I can triage your inbox, review your calendar, draft emails, or schedule events. What do you need?",
    time: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useAgentEvents(useCallback((e) => {
    if (e.event === 'freeform_response') {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        role: 'agent',
        content: (e.payload as { response: string }).response,
        time: new Date(),
        taskId: (e.payload as { taskId: string }).taskId,
      }]);
      setSending(false);
    }
    if (e.event === 'triage_complete') {
      const p = e.payload as { summary: string; totalEmails: number };
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        role: 'agent',
        content: `Triage complete. ${p.summary}\n\nProcessed ${p.totalEmails} emails. Check the Approvals tab for proposed actions.`,
        time: new Date(),
      }]);
      setSending(false);
    }
    if (e.event === 'calendar_review_complete') {
      const p = e.payload as { review: { summary: string } };
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        role: 'agent',
        content: `Calendar review done. ${p.review.summary}`,
        time: new Date(),
      }]);
      setSending(false);
    }
  }, []));

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    setMessages(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: text,
      time: new Date(),
    }]);

    // Route commands to specific task endpoints
    const lower = text.toLowerCase();
    if (lower.includes('triage') || lower.includes('inbox') || lower.includes('email')) {
      await fetch('/api/tasks/triage-email', { method: 'POST' });
    } else if (lower.includes('calendar') || lower.includes('schedule') || lower.includes('meeting')) {
      await fetch('/api/tasks/review-calendar', { method: 'POST' });
    } else {
      await fetch('/api/tasks/freeform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: text }),
      });
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

      {/* Messages */}
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

      {/* Input */}
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