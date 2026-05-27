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

const DB_PATH = path.join(os.homedir(), '.synqworks', 'synqworks.db');

// ── Shared state ───────────────────────────────────────────────────────────
const approval = new ApprovalQueue(DB_PATH);
const memory = new MemoryStore(DB_PATH);
const mcp = new MCPClient();
const events = new EventBus();

let agent: AdminAgent;
let agentReady = false;

// SSE clients — broadcast agent events to all connected browsers
const sseClients = new Set<(data: string) => void>();

function broadcast(event: string, payload: unknown) {
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

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function bootstrap() {
  await setupAdminMCP(mcp);
  agent = new AdminAgent({ approval, memory, mcp, events });
  agentReady = true;
  console.log('✅ SynqWorks API server ready');
}

// ── Hono app ───────────────────────────────────────────────────────────────
const app = new Hono();

app.use('*', cors({ origin: 'http://localhost:3001' }));

// Health check
app.get('/health', c => c.json({ status: 'ok', agentReady }));

// ── AGENT STATUS ──────────────────────────────────────────────────────────
app.get('/api/agent/status', c => {
  return c.json({
    admin: {
      role: 'admin',
      name: 'Admin Agent',
      status: agent?.status ?? 'idle',
    },
  });
});

// ── APPROVAL QUEUE ────────────────────────────────────────────────────────
app.get('/api/approvals', c => {
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
  const task = AdminTasks.triageEmail(20);
  // Run in background — SSE streams progress
  agent.run(task).catch(console.error);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/review-calendar', async c => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  const body = await c.req.json().catch(() => ({}));
  const task = AdminTasks.reviewCalendar(body.daysAhead ?? 7);
  agent.run(task).catch(console.error);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/freeform', async c => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  const { instruction } = await c.req.json();
  if (!instruction) return c.json({ error: 'instruction required' }, 400);
  const task = AdminTasks.freeform(instruction);
  agent.run(task).catch(console.error);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── MEMORY ────────────────────────────────────────────────────────────────
app.get('/api/memory', c => {
  const query = c.req.query('q') ?? '';
  const results = query
    ? memory.search(query)
    : memory.search('', undefined);
  return c.json(results);
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
bootstrap().then(() => {
  serve({ fetch: app.fetch, port: 3002 }, () => {
    console.log('🚀 API server running at http://localhost:3002');
  });
});