// Portfolio (command-center Zones 1–2) API routes.
// Registered from server.ts: registerPortfolioRoutes(app, DB_PATH)
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Context, Hono } from 'hono';
import {
  PortfolioStore,
  WipLimitError,
  IllegalTransitionError,
  type ProjectStatus,
  type ProjectLane,
} from '@wireassist/core';

const STATUSES: ProjectStatus[] = ['active', 'paused', 'icebox', 'done'];
const LANES: ProjectLane[] = ['product', 'career', 'client', 'personal'];

export function registerPortfolioRoutes(app: Hono, dbPath: string): PortfolioStore {
  mkdirSync(dirname(dbPath), { recursive: true });
  const store = new PortfolioStore(dbPath);

  // Zone 1 payload: iso week, this week's focus (null => gate), active projects.
  app.get('/api/portfolio/today', async (c) => c.json(await store.today()));

  app.get('/api/portfolio/projects', async (c) => {
    const status = c.req.query('status') as ProjectStatus | undefined;
    if (status && !STATUSES.includes(status)) {
      return c.json({ error: `Invalid status '${status}'` }, 400);
    }
    return c.json({ projects: await store.listProjects(status ? { status } : undefined) });
  });

  app.post('/api/portfolio/projects', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.name || !LANES.includes(body.lane)) {
      return c.json(
        { error: 'Required: name (string), lane (product|career|client|personal)' },
        400
      );
    }
    try {
      const id = await store.createProject({
        name: body.name,
        lane: body.lane,
        status: body.status,
        resumeNote: body.resumeNote,
        metadata: body.metadata,
      });
      return c.json({ id }, 201);
    } catch (err) {
      return portfolioError(c, err);
    }
  });

  app.post('/api/portfolio/projects/:id/transition', async (c) => {
    const body = await c.req.json().catch(() => null);
    const to = body?.to as ProjectStatus | undefined;
    if (!to || !STATUSES.includes(to)) {
      return c.json({ error: `Required: to (${STATUSES.join('|')})` }, 400);
    }
    try {
      await store.transition(c.req.param('id'), to, body?.resumeNote);
      return c.json({ ok: true });
    } catch (err) {
      return portfolioError(c, err);
    }
  });

  app.get('/api/portfolio/focus', async (c) => {
    const focus = await store.getWeeklyFocus(c.req.query('week') ?? undefined);
    return c.json({ focus });
  });

  app.post('/api/portfolio/focus', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.productProjectId || !body?.careerMilestone) {
      return c.json({ error: 'Required: productProjectId, careerMilestone' }, 400);
    }
    try {
      const focus = await store.setWeeklyFocus({
        productProjectId: body.productProjectId,
        careerMilestone: body.careerMilestone,
        isoWeek: body.isoWeek,
      });
      return c.json({ focus }, 201);
    } catch (err) {
      return portfolioError(c, err);
    }
  });

  app.get('/api/portfolio/events', async (c) => {
    const limit = Number(c.req.query('limit') ?? 50);
    const projectId = c.req.query('projectId') ?? undefined;
    return c.json({ events: await store.listEvents({ projectId, limit }) });
  });

  return store;
}

function portfolioError(c: Context, err: unknown) {
  if (err instanceof WipLimitError) return c.json({ error: err.message, code: 'WIP_LIMIT' }, 409);
  if (err instanceof IllegalTransitionError) {
    return c.json({ error: err.message, code: 'ILLEGAL_TRANSITION' }, 422);
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  const status = /not found/i.test(message) ? 404 : /active project/i.test(message) ? 422 : 500;
  return c.json({ error: message }, status);
}
