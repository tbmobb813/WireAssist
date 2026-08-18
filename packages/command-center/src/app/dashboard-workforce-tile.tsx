'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ObjectivePicker, useActiveObjectives } from './objective-picker';

interface AgentCard {
  role: string;
  name: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'error';
}

// role 'strategy' is NixOps — there's no dedicated 'ops' AgentRole yet.
function agentLink(role: string): { href: string; label: string } {
  switch (role) {
    case 'content':
      return { href: '/content', label: 'Open content' };
    case 'gtm':
      return { href: '/gtm', label: 'Open GTM' };
    case 'research':
      return { href: '/research', label: 'Open research' };
    case 'strategy':
      return { href: '/ops', label: 'Open ops' };
    case 'github':
      return { href: '/github', label: 'Open GitHub' };
    default:
      return { href: '/chat', label: 'Ask via chat' };
  }
}

const statusColor = (s: string) =>
  ({
    idle: '#4fc3f7',
    running: '#00ff9d',
    waiting_approval: '#ffb347',
    error: '#ef4444',
  })[s] ?? '#4fc3f7';

const statusLabel = (s: string) =>
  ({
    idle: 'IDLE',
    running: 'RUNNING',
    waiting_approval: 'NEEDS APPROVAL',
    error: 'ERROR',
  })[s] ?? s.toUpperCase();

export default function DashboardWorkforceTile({
  agents,
  onRunTriage,
  onRunCalendar,
}: {
  agents: AgentCard[];
  onRunTriage: (objectiveId: string) => void;
  onRunCalendar: (objectiveId: string) => void;
}) {
  const activeObjectives = useActiveObjectives();
  const [objectiveId, setObjectiveId] = useState('');

  return (
    // Status at a glance; click through for detail.
    <div className="md:col-span-2">
      <div className="text-sm font-semibold text-gray-300 mb-4">Workforce</div>
      <div className="space-y-2">
        {agents.map((agent) => (
          <Link
            key={agent.role}
            href={agentLink(agent.role).href}
            className="flex items-center justify-between rounded-xl px-4 py-3 border transition-colors hover:border-accent/40"
            style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: statusColor(agent.status) }}
              />
              <div>
                <div className="font-medium text-sm text-gray-200">{agent.name}</div>
                <div className="text-xs text-gray-600">{agent.role}</div>
              </div>
            </div>
            <div
              className="text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0"
              style={{
                color: statusColor(agent.status),
                background: `${statusColor(agent.status)}15`,
              }}
            >
              {statusLabel(agent.status)}
            </div>
          </Link>
        ))}
      </div>

      {/* Admin's one-shot actions — the only agent triggerable straight from the video wall */}
      <div className="mt-2">
        <ObjectivePicker
          objectives={activeObjectives}
          value={objectiveId}
          onChange={setObjectiveId}
        />
        <div className="flex gap-2">
          <button
            onClick={() => onRunTriage(objectiveId)}
            className="flex-1 text-xs py-2 px-3 rounded-lg border border-border text-gray-500 hover:border-accent hover:text-accent transition-colors"
          >
            Triage inbox
          </button>
          <button
            onClick={() => onRunCalendar(objectiveId)}
            className="flex-1 text-xs py-2 px-3 rounded-lg border border-border text-gray-500 hover:border-accent hover:text-accent transition-colors"
          >
            Review calendar
          </button>
        </div>
      </div>
    </div>
  );
}
