// Cross-agent Objective API routes.
// Registered from server.ts: registerObjectiveRoutes(app, DB_PATH)
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Context, Hono } from 'hono';
import { ObjectiveStore, type ObjectiveStatus } from '@wireassist/core';

const STATUSES: ObjectiveStatus[] = ['active', 'paused', 'completed'];

export function registerObjectiveRoutes(app: Hono, dbPath: string): ObjectiveStore {
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

  return store;
}

function objectiveError(c: Context, err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const status = /not found/i.test(message) ? 404 : 500;
  return c.json({ error: message }, status);
}
