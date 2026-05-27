'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import Link from 'next/link';

interface AgentCard {
  role: string;
  name: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'error';
}

interface ActivityItem {
  id: string;
  time: Date;
  event: string;
  description: string;
  role: string;
}

export default function Dashboard() {
  const [agents, setAgents] = useState<AgentCard[]>([
    { role: 'admin', name: 'Admin Agent', status: 'idle' },
  ]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Poll pending approvals count
  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/approvals');
      const data = await res.json();
      setPendingCount(data.length);
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  // Live agent status
  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch('/api/agent/status');
      const data = await res.json();
      setAgents([data.admin]);
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 3000);
    return () => clearInterval(t);
  }, []);

  const addActivity = useCallback((event: string, description: string, role: string) => {
    setActivity(prev => [{
      id: Math.random().toString(36).slice(2),
      time: new Date(),
      event,
      description,
      role,
    }, ...prev].slice(0, 50));
  }, []);

  useAgentEvents(useCallback((e) => {
    switch (e.event) {
      case 'task_started':
        setAgents(prev => prev.map(a =>
          a.role === e.payload.agentRole ? { ...a, status: 'running' } : a
        ));
        addActivity('started', e.payload.description, e.payload.agentRole);
        break;
      case 'task_complete':
        setAgents(prev => prev.map(a =>
          a.role === e.payload.agentRole ? { ...a, status: 'idle' } : a
        ));
        addActivity('completed', 'Task finished', e.payload.agentRole);
        break;
      case 'task_failed':
        setAgents(prev => prev.map(a =>
          a.role === e.payload.agentRole ? { ...a, status: 'error' } : a
        ));
        addActivity('failed', e.payload.error, e.payload.agentRole);
        break;
      case 'waiting_approval':
        setAgents(prev => prev.map(a =>
          a.role === e.payload.agentRole ? { ...a, status: 'waiting_approval' } : a
        ));
        setPendingCount(c => c + 1);
        addActivity('approval', e.payload.action, e.payload.agentRole);
        break;
      case 'approval_resolved':
        setPendingCount(c => Math.max(0, c - 1));
        break;
    }
  }, [addActivity]));

  const statusColor = (s: string) => ({
    idle: '#4fc3f7',
    running: '#00ff9d',
    waiting_approval: '#ffb347',
    error: '#ef4444',
  }[s] ?? '#4fc3f7');

  const statusLabel = (s: string) => ({
    idle: 'IDLE',
    running: 'RUNNING',
    waiting_approval: 'NEEDS APPROVAL',
    error: 'ERROR',
  }[s] ?? s.toUpperCase());

  const runTriage = async () => {
    await fetch('/api/tasks/triage-email', { method: 'POST' });
  };

  const runCalendar = async () => {
    await fetch('/api/tasks/review-calendar', { method: 'POST' });
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-10">
        <div className="text-xs tracking-widest text-accent mb-2">SYNQWORKS // COMMAND CENTER</div>
        <h1 className="text-4xl font-black tracking-tight">RUN A BUSINESS. SOLO.</h1>
        <p className="text-gray-500 text-sm mt-2 tracking-widest">AI WORKFORCE OPERATIONS DASHBOARD</p>
      </div>

      {/* Nav */}
      <div className="flex gap-2 mb-10">
        {[
          { href: '/', label: 'DASHBOARD' },
          { href: '/approvals', label: `APPROVALS${pendingCount > 0 ? ` (${pendingCount})` : ''}`, urgent: pendingCount > 0 },
          { href: '/chat', label: 'AGENT CHAT' },
          { href: '/memory', label: 'MEMORY' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="px-4 py-2 text-xs tracking-widest border rounded transition-colors"
            style={{
              borderColor: item.urgent ? '#ffb347' : '#1e2040',
              color: item.urgent ? '#ffb347' : '#475569',
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Agent Cards */}
        <div className="col-span-1 space-y-4">
          <div className="text-xs tracking-widest text-gray-500 mb-4">WORKFORCE</div>

          {agents.map(agent => (
            <div
              key={agent.role}
              className="rounded-lg p-5 border"
              style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-bold text-sm">{agent.name}</div>
                  <div className="text-xs text-gray-500 mt-1 tracking-widest">{agent.role.toUpperCase()}</div>
                </div>
                <div
                  className="text-xs tracking-widest px-2 py-1 rounded"
                  style={{
                    color: statusColor(agent.status),
                    background: `${statusColor(agent.status)}15`,
                    border: `1px solid ${statusColor(agent.status)}30`,
                  }}
                >
                  {statusLabel(agent.status)}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={runTriage}
                  className="w-full text-left text-xs py-2 px-3 rounded border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
                >
                  → Triage inbox
                </button>
                <button
                  onClick={runCalendar}
                  className="w-full text-left text-xs py-2 px-3 rounded border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
                >
                  → Review calendar
                </button>
                <Link
                  href="/chat"
                  className="block text-xs py-2 px-3 rounded border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
                >
                  → Open chat
                </Link>
              </div>
            </div>
          ))}

          {/* Pending approvals badge */}
          {pendingCount > 0 && (
            <Link
              href="/approvals"
              className="block rounded-lg p-4 border transition-colors"
              style={{ background: '#1a1200', borderColor: '#ffb34750' }}
            >
              <div className="text-xs tracking-widest text-amber mb-1">ACTION REQUIRED</div>
              <div className="text-sm font-bold">
                {pendingCount} pending approval{pendingCount > 1 ? 's' : ''}
              </div>
            </Link>
          )}
        </div>

        {/* Activity Feed */}
        <div className="col-span-2">
          <div className="text-xs tracking-widest text-gray-500 mb-4">ACTIVITY FEED</div>
          <div
            className="rounded-lg border overflow-hidden"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            {activity.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">
                No activity yet. Run a task to get started.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activity.map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-start gap-4">
                    <div className="text-xs text-gray-600 mt-0.5 whitespace-nowrap">
                      {item.time.toLocaleTimeString()}
                    </div>
                    <div
                      className="text-xs tracking-widest mt-0.5 whitespace-nowrap"
                      style={{ color: {
                        started: '#4fc3f7',
                        completed: '#00ff9d',
                        failed: '#ef4444',
                        approval: '#ffb347',
                      }[item.event] ?? '#475569' }}
                    >
                      {item.event.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-300 flex-1 truncate">{item.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}