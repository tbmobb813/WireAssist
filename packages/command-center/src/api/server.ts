import './load-env';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import * as path from 'path';
import * as os from 'os';
import {
  ApprovalQueue,
  MemoryStore,
  MCPClient,
  EventBus,
} from '@synqworks/core';
import { AdminAgent, setupAdminMCP, AdminTasks } from '@synqworks/agent-admin';
import { ContentAgent, ContentTasks } from '@synqworks/agent-content';
import { registerSynqPostTools, SynqPostStorage } from '@synqworks/synqpost-mcp';

const HOME_PATH = process.env.SYNQWORKS_HOME ?? os.homedir();
const DB_PATH = path.join(HOME_PATH, '.synqworks', 'synqworks.db');

// ── Shared state ───────────────────────────────────────────────────────────
const mcp = new MCPClient();
const events = new EventBus();

let approval: ApprovalQueue;
let memory: MemoryStore;
let agent: AdminAgent;
let contentAgent: ContentAgent;
let synqpostStorage: SynqPostStorage;
let agentReady = false;

function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function anthropicRequiredResponse() {
  return {
    error:
      'ANTHROPIC_API_KEY is not set. Export it before running agent tasks: export ANTHROPIC_API_KEY=sk-ant-...',
  };
}

function logAgentTaskError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('Could not resolve authentication method')) {
    console.error(
      '❌ Anthropic auth failed — set ANTHROPIC_API_KEY in the environment where you run pnpm dev:command-center',
    );
    return;
  }
  console.error('❌ Agent task failed:', err);
}

/** Run one admin task at a time so events and status stay coherent. */
let adminTaskChain: Promise<void> = Promise.resolve();

function queueAgentTask(task: Parameters<AdminAgent['run']>[0]) {
  adminTaskChain = adminTaskChain
    .then(() => agent.run(task))
    .catch(logAgentTaskError);
  return task;
}

/** Run one content task at a time. */
let contentTaskChain: Promise<void> = Promise.resolve();

function queueContentTask(task: Parameters<ContentAgent['run']>[0]) {
  contentTaskChain = contentTaskChain
    .then(() => contentAgent.run(task))
    .catch(logAgentTaskError);
  return task;
}

function sqliteSetupHint(): string {
  return (
    'SQLite (better-sqlite3) is not built. Run:\n' +
    '  pnpm approve-builds   # enable better-sqlite3\n' +
    '  pnpm install && pnpm rebuild better-sqlite3'
  );
}

function openStores() {
  try {
    approval = new ApprovalQueue(DB_PATH);
    memory = new MemoryStore(DB_PATH);
  } catch (err) {
    console.error(`❌ ${sqliteSetupHint()}`);
    throw err;
  }
}

// SSE clients — broadcast agent events to all connected browsers
const sseClients = new Set<(data: string) => void>();

interface ActivityRecord {
  event: string;
  payload: unknown;
  at: string;
}

const recentActivity: ActivityRecord[] = [];
const MAX_ACTIVITY = 100;

function broadcast(event: string, payload: unknown) {
  recentActivity.unshift({ event, payload, at: new Date().toISOString() });
  if (recentActivity.length > MAX_ACTIVITY) recentActivity.pop();

  const data = `data: ${JSON.stringify({ event, payload })}\n\n`;
  sseClients.forEach(send => send(data));
}

// Wire EventBus → SSE broadcasts
events.on('agent:task_started', p => broadcast('task_started', p));
events.on('agent:task_complete', p => broadcast('task_complete', p));
events.on('agent:task_failed', p => broadcast('task_failed', p));
events.on('agent:waiting_approval', p => broadcast('waiting_approval', p));
events.on('agent:approval_resolved', p => broadcast('approval_resolved', p));
events.on('agent:triage_complete', p => broadcast('triage_complete', p));
events.on('agent:calendar_review_complete', p => broadcast('calendar_review_complete', p));
events.on('agent:freeform_response', p => broadcast('freeform_response', p));
events.on('agent:content_generated', p => broadcast('content_generated', p));
events.on('agent:content_approved', p => broadcast('content_approved', p));
events.on('agent:content_plan_generated', p => broadcast('content_plan_generated', p));
events.on('agent:post_scheduled', p => broadcast('post_scheduled', p));
events.on('agent:content_analyzed', p => broadcast('content_analyzed', p));
events.on('agent:scheduled_posts', p => broadcast('scheduled_posts', p));

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function bootstrap() {
  openStores();
  await setupAdminMCP(mcp);
  synqpostStorage = new SynqPostStorage(DB_PATH);
  registerSynqPostTools(mcp, synqpostStorage);
  agent = new AdminAgent({ approval, memory, mcp, events });
  contentAgent = new ContentAgent({ approval, memory, mcp, events });
  agentReady = true;
  if (!anthropicConfigured()) {
    console.warn(
      '⚠️  ANTHROPIC_API_KEY is not set — dashboard loads, but triage/chat/calendar tasks will fail until you export it.',
    );
  }
  console.log('✅ SynqWorks API server ready');
}

// ── Hono app ───────────────────────────────────────────────────────────────
const app = new Hono();

app.use('*', cors({ origin: 'http://localhost:3001' }));

// Health check
app.get('/health', c =>
  c.json({ status: 'ok', agentReady, anthropicConfigured: anthropicConfigured() }),
);

// ── AGENT STATUS ──────────────────────────────────────────────────────────
app.get('/api/agent/status', c => {
  return c.json({
    admin: {
      role: 'admin',
      name: 'Admin Agent',
      status: agent?.status ?? 'idle',
    },
    content: {
      role: 'content',
      name: 'Content Agent',
      status: contentAgent?.status ?? 'idle',
    },
  });
});

// Recent agent events (for activity feed on load / missed SSE)
app.get('/api/activity', c => {
  const taskId = c.req.query('taskId');
  if (!taskId) return c.json(recentActivity);
  const filtered = recentActivity.filter(r => {
    const p = r.payload as { taskId?: string };
    return p?.taskId === taskId;
  });
  return c.json(filtered);
});

// ── APPROVAL QUEUE ────────────────────────────────────────────────────────
app.get('/api/approvals', c => {
  if (!agentReady) return c.json([]);
  return c.json(approval.getPending());
});

app.post('/api/approvals/:id/approve', c => {
  const { id } = c.req.param();
  approval.resolve(id, true);
  broadcast('approval_resolved', { id, approved: true });
  return c.json({ ok: true });
});

app.post('/api/approvals/:id/reject', c => {
  const { id } = c.req.param();
  approval.resolve(id, false);
  broadcast('approval_resolved', { id, approved: false });
  return c.json({ ok: true });
});

// ── TASKS ─────────────────────────────────────────────────────────────────
app.post('/api/tasks/triage-email', async c => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const task = AdminTasks.triageEmail(20);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/review-calendar', async c => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const task = AdminTasks.reviewCalendar(body.daysAhead ?? 7);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/freeform', async c => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { instruction } = await c.req.json();
  if (!instruction) return c.json({ error: 'instruction required' }, 400);
  const task = AdminTasks.freeform(instruction);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── CONTENT TASKS ─────────────────────────────────────────────────────────
app.post('/api/tasks/generate-post', async c => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { topic, platform, tone } = await c.req.json();
  if (!topic || !platform) return c.json({ error: 'topic and platform required' }, 400);
  const task = ContentTasks.generatePost(topic, platform, tone);
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/generate-plan', async c => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const task = ContentTasks.generatePlan(
    body.platforms ?? ['linkedin', 'twitter'],
    body.weeksAhead ?? 1,
    body.postsPerWeek ?? 3,
  );
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── CONTENT DATA ──────────────────────────────────────────────────────────
app.get('/api/content/posts', c => {
  if (!agentReady) return c.json([]);
  const daysAhead = parseInt(c.req.query('daysAhead') ?? '14');
  const now = new Date();
  return c.json(synqpostStorage.listPosts({
    from: now,
    to: new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000),
  }));
});

app.get('/api/content/ideas', c => {
  if (!agentReady) return c.json([]);
  return c.json(synqpostStorage.listIdeas());
});

// ── MEMORY ────────────────────────────────────────────────────────────────
app.get('/api/memory', c => {
  const query = (c.req.query('q') ?? '').trim();
  if (!query) return c.json(memory.listRecent());
  return c.json(memory.search(query));
});

// ── SSE STREAM ────────────────────────────────────────────────────────────
app.get('/api/events', c => {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: string) => {
    writer.write(encoder.encode(data)).catch(() => {
      sseClients.delete(send);
    });
  };

  sseClients.add(send);

  // Send initial ping
  send('data: {"event":"connected"}\n\n');

  // Cleanup on disconnect
  c.req.raw.signal.addEventListener('abort', () => {
    sseClients.delete(send);
    writer.close();
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
const API_PORT = Number(process.env.API_PORT ?? 3002);

const server = serve({ fetch: app.fetch, port: API_PORT }, (info) => {
  console.log(`🚀 API server running at http://localhost:${info.port}`);
  bootstrap().catch((err) => {
    console.error('❌ Agent bootstrap failed:', err);
    process.exit(1);
  });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `❌ Port ${API_PORT} is already in use.\n` +
        `   Stop the other process: fuser -k ${API_PORT}/tcp\n` +
        `   Or use another port: API_PORT=3003 pnpm dev:api`,
    );
    process.exit(1);
  }
  throw err;
});