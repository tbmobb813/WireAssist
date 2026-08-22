// Cross-agent Objective API routes.
// Registered from server.ts: registerObjectiveRoutes(app, DB_PATH, pushSSE)
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import type { Context, Hono } from 'hono';
import { ObjectiveStore, type ObjectiveStatus } from '@wireassist/core';
import { foldTasks, type ManualTaskCard } from '../lib/objective-events';

const STATUSES: ObjectiveStatus[] = ['active', 'paused', 'completed'];

type KanbanColumn = 'todo' | 'in_progress' | 'review' | 'done';
const KANBAN_COLUMNS: KanbanColumn[] = ['todo', 'in_progress', 'review', 'done'];

export function registerObjectiveRoutes(
  app: Hono,
  dbPath: string,
  pushSSE: (event: string, payload: unknown) => void
): ObjectiveStore {
  mkdirSync(dirname(dbPath), { recursive: true });
  const store = new ObjectiveStore(dbPath);

  app.get('/api/objectives', async (c) => {
    const status = c.req.query('status') as ObjectiveStatus | undefined;
    if (status && !STATUSES.includes(status)) {
      return c.json({ error: `Invalid status '${status}'` }, 400);
    }
    return c.json({ objectives: await store.listObjectives(status ? { status } : undefined) });
  });

  app.post('/api/objectives', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.title) {
      return c.json({ error: 'Required: title (string)' }, 400);
    }
    const id = await store.createObjective({
      title: body.title,
      description: body.description,
      status: body.status,
    });
    return c.json({ id }, 201);
  });

  app.get('/api/objectives/:id', async (c) => {
    const objective = await store.getObjective(c.req.param('id'));
    if (!objective) return c.json({ error: 'Objective not found' }, 404);
    const events = await store.listEvents({ objectiveId: objective.id });
    return c.json({ objective, events });
  });

  app.post('/api/objectives/:id/transition', async (c) => {
    const body = await c.req.json().catch(() => null);
    const to = body?.to as ObjectiveStatus | undefined;
    if (!to || !STATUSES.includes(to)) {
      return c.json({ error: `Required: to (${STATUSES.join('|')})` }, 400);
    }
    try {
      await store.transition(c.req.param('id'), to);
      return c.json({ ok: true });
    } catch (err) {
      return objectiveError(c, err);
    }
  });

  app.post('/api/objectives/:id/update', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'title and/or description required' }, 400);
    }
    try {
      const objective = await store.updateObjective(c.req.param('id'), {
        title: body.title,
        description: body.description,
      });
      return c.json({ objective });
    } catch (err) {
      return objectiveError(c, err);
    }
  });

  // ── Kanban board: manual cards ──────────────────────────────────────
  // Agent-task cards are purely derived from the agent lifecycle events
  // already recorded via broadcast() — no routes needed for those. These
  // two routes cover only the human-created/human-moved half of the board.
  // Written directly via store.recordAgentEvent (not broadcast()) since
  // these aren't agent-bus-sourced events — they use the objective.*
  // prefix, matching objective.created/objective.transitioned, not the
  // agent.* prefix broadcast() applies.

  app.post('/api/objectives/:id/cards', async (c) => {
    const id = c.req.param('id');
    const objective = await store.getObjective(id);
    if (!objective) return c.json({ error: 'Objective not found' }, 404);

    const body = await c.req.json().catch(() => null);
    if (!body?.text || typeof body.text !== 'string' || body.text.length > 500) {
      return c.json({ error: 'Required: text (string, up to 500 characters)' }, 400);
    }

    const cardId = randomUUID();
    const createdAt = Date.now();
    await store.recordAgentEvent('objective.manual_task_created', id, {
      cardId,
      text: body.text,
    });
    const payload = { objectiveId: id, cardId, text: body.text, column: 'todo' as KanbanColumn };
    pushSSE('manual_card_created', payload);

    return c.json(
      {
        card: {
          kind: 'manual',
          cardId,
          text: body.text,
          column: 'todo',
          createdAt,
          updatedAt: createdAt,
        },
      },
      201
    );
  });

  app.post('/api/objectives/:id/cards/:cardId/move', async (c) => {
    const id = c.req.param('id');
    const cardId = c.req.param('cardId');
    const objective = await store.getObjective(id);
    if (!objective) return c.json({ error: 'Objective not found' }, 404);

    const body = await c.req.json().catch(() => null);
    const to = body?.to as KanbanColumn | undefined;
    if (!to || !KANBAN_COLUMNS.includes(to)) {
      return c.json({ error: `Required: to (${KANBAN_COLUMNS.join('|')})` }, 400);
    }

    const events = await store.listEvents({ objectiveId: id });
    const card = foldTasks(events).find(
      (c): c is ManualTaskCard => c.kind === 'manual' && c.cardId === cardId
    );
    if (!card) return c.json({ error: 'Card not found' }, 404);

    await store.recordAgentEvent('objective.manual_task_moved', id, { cardId, to });
    pushSSE('manual_card_moved', { objectiveId: id, cardId, to });

    return c.json({ card: { ...card, column: to, updatedAt: Date.now() } });
  });

  return store;
}

function objectiveError(c: Context, err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const status = /not found/i.test(message) ? 404 : 500;
  return c.json({ error: message }, status);
}
