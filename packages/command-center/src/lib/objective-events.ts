// Shared event-parsing logic for the Objective detail page: folds the
// durable ObjectiveEvent ledger into the two current-state views the page
// renders (the Team Directory roster, and the Kanban board), plus a
// human-readable one-liner per event for the Activity feed. Extracted out of
// the page component so this logic (previously untested, since this repo has
// no React component test infra) gets real jest coverage.

export type ObjectiveStatus = 'active' | 'paused' | 'completed';
export type AgentRole = 'admin' | 'content' | 'research' | 'strategy' | 'gtm';
export type RosterStatus = 'idle' | 'running' | 'waiting_approval' | 'error';

export interface Objective {
  id: string;
  title: string;
  description: string | null;
  status: ObjectiveStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ObjectiveEvent {
  id: string;
  objectiveId: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: number;
}

export interface RosterEntry {
  status: RosterStatus;
  lastDescription: string | null;
  lastAt: number | null;
}

export function emptyRoster(): Record<AgentRole, RosterEntry> {
  return {
    admin: { status: 'idle', lastDescription: null, lastAt: null },
    content: { status: 'idle', lastDescription: null, lastAt: null },
    research: { status: 'idle', lastDescription: null, lastAt: null },
    strategy: { status: 'idle', lastDescription: null, lastAt: null },
    gtm: { status: 'idle', lastDescription: null, lastAt: null },
  };
}

function stripAgentPrefix(type: string): string {
  return type.startsWith('agent.') ? type.slice('agent.'.length) : type;
}

// Folds a chronological (oldest-first) event list into a per-role current
// status — task_started -> running, task_complete -> idle, task_failed ->
// error, waiting_approval -> waiting_approval.
export function foldRoster(events: ObjectiveEvent[]): Record<AgentRole, RosterEntry> {
  const roster = emptyRoster();
  for (const e of events) {
    const type = stripAgentPrefix(e.type);
    const payload = e.payload as {
      agentRole?: AgentRole;
      description?: string;
      error?: string;
    } | null;
    const role = payload?.agentRole;
    if (!role || !(role in roster)) continue;

    if (type === 'task_started') {
      roster[role] = {
        status: 'running',
        lastDescription: payload?.description ?? roster[role].lastDescription,
        lastAt: e.createdAt,
      };
    } else if (type === 'task_complete') {
      roster[role] = { ...roster[role], status: 'idle', lastAt: e.createdAt };
    } else if (type === 'task_failed') {
      roster[role] = {
        status: 'error',
        lastDescription: payload?.error ?? roster[role].lastDescription,
        lastAt: e.createdAt,
      };
    } else if (type === 'waiting_approval') {
      roster[role] = { ...roster[role], status: 'waiting_approval', lastAt: e.createdAt };
    }
  }
  return roster;
}

export function describeEvent(e: ObjectiveEvent): string {
  const type = stripAgentPrefix(e.type);
  const payload = e.payload as {
    agentRole?: string;
    description?: string;
    error?: string;
    action?: string;
    to?: string;
    text?: string;
  } | null;
  switch (e.type) {
    case 'objective.created':
      return 'Objective created';
    case 'objective.transitioned':
      return `Status changed to ${payload?.to ?? 'unknown'}`;
    case 'objective.manual_task_created':
      return `Card added: ${payload?.text ?? ''}`;
    case 'objective.manual_task_moved':
      return `Card moved to ${payload?.to ?? 'unknown'}`;
  }
  switch (type) {
    case 'task_started':
      return `${payload?.agentRole ?? 'agent'} started: ${payload?.description ?? ''}`;
    case 'task_complete':
      return `${payload?.agentRole ?? 'agent'} completed a task`;
    case 'task_failed':
      return `${payload?.agentRole ?? 'agent'} failed: ${payload?.error ?? ''}`;
    case 'waiting_approval':
      return `${payload?.agentRole ?? 'agent'} waiting on approval: ${payload?.action ?? ''}`;
    case 'approval_resolved':
      return `${payload?.agentRole ?? 'agent'} approval resolved`;
    default:
      return type;
  }
}

// ── Kanban board ────────────────────────────────────────────────────────

export type KanbanColumn = 'todo' | 'in_progress' | 'review' | 'done';

export interface AgentTaskCard {
  kind: 'agent';
  taskId: string;
  agentRole: AgentRole;
  description: string;
  column: KanbanColumn;
  errored: boolean;
  error?: string;
  updatedAt: number;
}

export interface ManualTaskCard {
  kind: 'manual';
  cardId: string;
  text: string;
  column: KanbanColumn;
  createdAt: number;
  updatedAt: number;
}

export type KanbanCard = AgentTaskCard | ManualTaskCard;

// Folds a chronological (oldest-first) event list into the current set of
// Kanban cards. Agent-task cards are purely derived from agent lifecycle
// events (read-only — a human never moves them); manual cards are created
// and moved via their own objective.manual_task_* events.
export function foldTasks(events: ObjectiveEvent[]): KanbanCard[] {
  const agentTasks = new Map<string, AgentTaskCard>();
  const manualCards = new Map<string, ManualTaskCard>();

  for (const e of events) {
    if (e.type === 'objective.manual_task_created') {
      const payload = e.payload as { cardId?: string; text?: string } | null;
      if (!payload?.cardId) continue;
      manualCards.set(payload.cardId, {
        kind: 'manual',
        cardId: payload.cardId,
        text: payload.text ?? '',
        column: 'todo',
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
      });
      continue;
    }

    if (e.type === 'objective.manual_task_moved') {
      const payload = e.payload as { cardId?: string; to?: KanbanColumn } | null;
      if (!payload?.cardId || !payload.to) continue;
      const existing = manualCards.get(payload.cardId);
      if (!existing) continue;
      manualCards.set(payload.cardId, { ...existing, column: payload.to, updatedAt: e.createdAt });
      continue;
    }

    const type = stripAgentPrefix(e.type);
    const payload = e.payload as {
      taskId?: string;
      agentRole?: AgentRole;
      description?: string;
      error?: string;
    } | null;
    const taskId = payload?.taskId;
    if (!taskId) continue;
    const existing = agentTasks.get(taskId);

    switch (type) {
      case 'task_queued':
        agentTasks.set(taskId, {
          kind: 'agent',
          taskId,
          agentRole: payload?.agentRole ?? existing?.agentRole ?? 'admin',
          description: payload?.description ?? existing?.description ?? '',
          column: 'todo',
          errored: false,
          updatedAt: e.createdAt,
        });
        break;
      case 'task_started':
        // No prior task_queued event is possible for objectives created
        // before this feature shipped — create the card here too, not
        // just update one that's assumed to already exist.
        agentTasks.set(taskId, {
          kind: 'agent',
          taskId,
          agentRole: payload?.agentRole ?? existing?.agentRole ?? 'admin',
          description: payload?.description ?? existing?.description ?? '',
          column: 'in_progress',
          errored: false,
          updatedAt: e.createdAt,
        });
        break;
      case 'waiting_approval':
        if (existing) {
          agentTasks.set(taskId, { ...existing, column: 'review', updatedAt: e.createdAt });
        }
        break;
      case 'approval_resolved':
        // Approval is a mid-task gate, not a finish line — the skill keeps
        // running afterward and run() still eventually emits
        // task_complete/task_failed.
        if (existing) {
          agentTasks.set(taskId, { ...existing, column: 'in_progress', updatedAt: e.createdAt });
        }
        break;
      case 'task_complete':
        if (existing) {
          agentTasks.set(taskId, {
            ...existing,
            column: 'done',
            errored: false,
            updatedAt: e.createdAt,
          });
        }
        break;
      case 'task_failed':
        agentTasks.set(taskId, {
          kind: 'agent',
          taskId,
          agentRole: payload?.agentRole ?? existing?.agentRole ?? 'admin',
          description: existing?.description ?? '',
          column: 'done',
          errored: true,
          error: payload?.error,
          updatedAt: e.createdAt,
        });
        break;
      default:
        break;
    }
  }

  return [...agentTasks.values(), ...manualCards.values()];
}
