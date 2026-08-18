import {
  foldRoster,
  foldTasks,
  describeEvent,
  type ObjectiveEvent,
  type AgentTaskCard,
  type ManualTaskCard,
} from '../lib/objective-events';

function evt(
  type: string,
  payload: Record<string, unknown> | null,
  createdAt = Date.now()
): ObjectiveEvent {
  return { id: `e-${Math.random()}`, objectiveId: 'obj-1', type, payload, createdAt };
}

describe('foldRoster', () => {
  it('moves a role to running on task_started, capturing description', () => {
    const roster = foldRoster([
      evt('agent.task_started', { agentRole: 'content', description: 'do a thing' }),
    ]);
    expect(roster.content.status).toBe('running');
    expect(roster.content.lastDescription).toBe('do a thing');
  });

  it('moves a role to idle on task_complete', () => {
    const roster = foldRoster([
      evt('agent.task_started', { agentRole: 'content', description: 'x' }, 1),
      evt('agent.task_complete', { agentRole: 'content' }, 2),
    ]);
    expect(roster.content.status).toBe('idle');
  });

  it('moves a role to error on task_failed, capturing the error into lastDescription', () => {
    const roster = foldRoster([evt('agent.task_failed', { agentRole: 'gtm', error: 'boom' })]);
    expect(roster.gtm.status).toBe('error');
    expect(roster.gtm.lastDescription).toBe('boom');
  });

  it('moves a role to waiting_approval on waiting_approval', () => {
    const roster = foldRoster([evt('agent.waiting_approval', { agentRole: 'research' })]);
    expect(roster.research.status).toBe('waiting_approval');
  });

  it('strips the agent. prefix', () => {
    const roster = foldRoster([evt('task_started', { agentRole: 'admin', description: 'y' })]);
    expect(roster.admin.status).toBe('running');
  });

  it('tracks the github role (previously silently dropped — missing from the roster union)', () => {
    const roster = foldRoster([
      evt('agent.task_started', { agentRole: 'github', description: 'open a PR' }),
    ]);
    expect(roster.github.status).toBe('running');
    expect(roster.github.lastDescription).toBe('open a PR');
  });

  it('ignores an event with no recognized agentRole', () => {
    const roster = foldRoster([evt('agent.task_started', { description: 'no role' })]);
    expect(Object.values(roster).every((r) => r.status === 'idle')).toBe(true);
  });

  it('updates two roles independently', () => {
    const roster = foldRoster([
      evt('agent.task_started', { agentRole: 'content' }),
      evt('agent.waiting_approval', { agentRole: 'gtm' }),
    ]);
    expect(roster.content.status).toBe('running');
    expect(roster.gtm.status).toBe('waiting_approval');
    expect(roster.research.status).toBe('idle');
  });
});

describe('describeEvent', () => {
  it('describes objective.created', () => {
    expect(describeEvent(evt('objective.created', { title: 'x' }))).toBe('Objective created');
  });

  it('describes objective.transitioned', () => {
    expect(describeEvent(evt('objective.transitioned', { from: 'active', to: 'paused' }))).toBe(
      'Status changed to paused'
    );
  });

  it('describes objective.manual_task_created', () => {
    expect(describeEvent(evt('objective.manual_task_created', { text: 'write docs' }))).toBe(
      'Card added: write docs'
    );
  });

  it('describes objective.manual_task_moved', () => {
    expect(describeEvent(evt('objective.manual_task_moved', { to: 'done' }))).toBe(
      'Card moved to done'
    );
  });

  it('describes each agent event kind', () => {
    expect(
      describeEvent(evt('agent.task_started', { agentRole: 'content', description: 'a post' }))
    ).toBe('content started: a post');
    expect(describeEvent(evt('agent.task_complete', { agentRole: 'content' }))).toBe(
      'content completed a task'
    );
    expect(describeEvent(evt('agent.task_failed', { agentRole: 'content', error: 'oops' }))).toBe(
      'content failed: oops'
    );
    expect(
      describeEvent(evt('agent.waiting_approval', { agentRole: 'content', action: 'send it' }))
    ).toBe('content waiting on approval: send it');
    expect(describeEvent(evt('agent.approval_resolved', { agentRole: 'content' }))).toBe(
      'content approval resolved'
    );
  });

  it('falls back to the stripped type for anything else', () => {
    expect(describeEvent(evt('agent.content_generated', {}))).toBe('content_generated');
  });
});

describe('foldTasks — agent cards', () => {
  it('task_queued creates a todo card', () => {
    const cards = foldTasks([
      evt('agent.task_queued', { taskId: 't1', agentRole: 'content', description: 'a post' }),
    ]);
    expect(cards).toHaveLength(1);
    const card = cards[0] as AgentTaskCard;
    expect(card.kind).toBe('agent');
    expect(card.column).toBe('todo');
    expect(card.description).toBe('a post');
  });

  it('task_started with no prior task_queued still produces a card (pre-existing-objective case)', () => {
    const cards = foldTasks([
      evt('agent.task_started', { taskId: 't1', agentRole: 'research', description: 'dig in' }),
    ]);
    expect(cards).toHaveLength(1);
    expect((cards[0] as AgentTaskCard).column).toBe('in_progress');
  });

  it('waiting_approval moves an existing card to review', () => {
    const cards = foldTasks([
      evt('agent.task_started', { taskId: 't1', agentRole: 'research' }, 1),
      evt('agent.waiting_approval', { taskId: 't1', agentRole: 'research' }, 2),
    ]);
    expect((cards[0] as AgentTaskCard).column).toBe('review');
  });

  it('approval_resolved moves an existing card back to in_progress, not done', () => {
    const cards = foldTasks([
      evt('agent.task_started', { taskId: 't1', agentRole: 'research' }, 1),
      evt('agent.waiting_approval', { taskId: 't1', agentRole: 'research' }, 2),
      evt('agent.approval_resolved', { taskId: 't1', agentRole: 'research', approved: true }, 3),
    ]);
    expect((cards[0] as AgentTaskCard).column).toBe('in_progress');
  });

  it('task_complete moves an existing card to done, not errored', () => {
    const cards = foldTasks([
      evt('agent.task_started', { taskId: 't1', agentRole: 'gtm' }, 1),
      evt('agent.task_complete', { taskId: 't1', agentRole: 'gtm' }, 2),
    ]);
    const card = cards[0] as AgentTaskCard;
    expect(card.column).toBe('done');
    expect(card.errored).toBe(false);
  });

  it('task_failed moves an existing card to done, errored, with the error message', () => {
    const cards = foldTasks([
      evt('agent.task_started', { taskId: 't1', agentRole: 'gtm', description: 'strategy' }, 1),
      evt('agent.task_failed', { taskId: 't1', agentRole: 'gtm', error: 'LLM timeout' }, 2),
    ]);
    const card = cards[0] as AgentTaskCard;
    expect(card.column).toBe('done');
    expect(card.errored).toBe(true);
    expect(card.error).toBe('LLM timeout');
    expect(card.description).toBe('strategy');
  });

  it('task_failed with no prior card synthesizes one instead of dropping the failure', () => {
    const cards = foldTasks([
      evt('agent.task_failed', { taskId: 't1', agentRole: 'ops', error: 'boom' }),
    ]);
    expect(cards).toHaveLength(1);
    const card = cards[0] as AgentTaskCard;
    expect(card.column).toBe('done');
    expect(card.errored).toBe(true);
  });

  it('ignores an agent event with no taskId in payload', () => {
    expect(foldTasks([evt('agent.task_started', { agentRole: 'content' })])).toHaveLength(0);
  });

  it('ignores unrelated agent event types', () => {
    expect(foldTasks([evt('agent.content_generated', { taskId: 't1' })])).toHaveLength(0);
  });
});

describe('foldTasks — manual cards', () => {
  it('manual_task_created produces a todo card with the given text', () => {
    const cards = foldTasks([
      evt('objective.manual_task_created', { cardId: 'c1', text: 'ping bob' }),
    ]);
    expect(cards).toHaveLength(1);
    const card = cards[0] as ManualTaskCard;
    expect(card.kind).toBe('manual');
    expect(card.column).toBe('todo');
    expect(card.text).toBe('ping bob');
  });

  it('a move updates the column, last-move-wins across multiple moves', () => {
    const cards = foldTasks([
      evt('objective.manual_task_created', { cardId: 'c1', text: 'x' }, 1),
      evt('objective.manual_task_moved', { cardId: 'c1', to: 'review' }, 2),
      evt('objective.manual_task_moved', { cardId: 'c1', to: 'done' }, 3),
    ]);
    expect((cards[0] as ManualTaskCard).column).toBe('done');
  });

  it('a move referencing an unknown cardId is skipped without throwing', () => {
    expect(() =>
      foldTasks([evt('objective.manual_task_moved', { cardId: 'nope', to: 'done' })])
    ).not.toThrow();
    expect(
      foldTasks([evt('objective.manual_task_moved', { cardId: 'nope', to: 'done' })])
    ).toHaveLength(0);
  });
});

describe('foldTasks — mixed', () => {
  it('returns both agent and manual cards from one fold, regardless of interleaving', () => {
    const cards = foldTasks([
      evt('agent.task_queued', { taskId: 't1', agentRole: 'content', description: 'post' }, 1),
      evt('objective.manual_task_created', { cardId: 'c1', text: 'todo item' }, 2),
      evt('agent.task_started', { taskId: 't1', agentRole: 'content', description: 'post' }, 3),
      evt('objective.manual_task_moved', { cardId: 'c1', to: 'in_progress' }, 4),
    ]);
    expect(cards).toHaveLength(2);
    const agentCard = cards.find((c) => c.kind === 'agent') as AgentTaskCard;
    const manualCard = cards.find((c) => c.kind === 'manual') as ManualTaskCard;
    expect(agentCard.column).toBe('in_progress');
    expect(manualCard.column).toBe('in_progress');
  });
});
