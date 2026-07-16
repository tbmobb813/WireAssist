import './load-env';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ApprovalQueue, MemoryStore, MCPClient, EventBus } from '@wireassist/core';
import { AdminAgent, setupAdminMCP, AdminTasks } from '@wireassist/agent-admin';
import { ContentAgent, ContentTasks } from '@wireassist/agent-content';
import { ResearchAgent, ResearchTasks, setupResearchMCP } from '@wireassist/agent-research';
import { NixOpsAgent, OpsTasks } from '@wireassist/agent-ops';
import { registerTrendPostTools, TrendPostStorage } from '@wireassist/trendpost-mcp';
import { registerPortfolioRoutes } from './portfolio-routes';

const HOME_PATH = process.env.WIREASSIST_HOME ?? os.homedir();
const DB_PATH = path.join(HOME_PATH, '.wireassist', 'wireassist.db');

// ── Shared state ───────────────────────────────────────────────────────────
const mcp = new MCPClient();
const events = new EventBus();

let approval: ApprovalQueue;
let memory: MemoryStore;
let agent: AdminAgent;
let contentAgent: ContentAgent;
let researchAgent: ResearchAgent;
let opsAgent: NixOpsAgent;
let trendpostStorage: TrendPostStorage;
let agentReady = false;

// ── License tier gating ────────────────────────────────────────────────────
import Database from 'better-sqlite3';
let licenseDb: InstanceType<typeof Database> | null = null;

const TIER_RANK: Record<string, number> = { trial: 0, solo: 1, operator: 2, workforce: 3 };

function currentTier(): string {
  if (!licenseDb) return 'trial';
  const row = licenseDb
    .prepare('SELECT tier, expires_grace_at FROM licenses ORDER BY verified_at DESC LIMIT 1')
    .get() as { tier: string; expires_grace_at: string } | undefined;
  if (!row) return 'trial';
  return new Date(row.expires_grace_at) > new Date() ? row.tier : 'trial';
}

function tierGate(minTier: string): { allowed: boolean; error?: string } {
  const tier = currentTier();
  if ((TIER_RANK[tier] ?? 0) < (TIER_RANK[minTier] ?? 99)) {
    const label = minTier.charAt(0).toUpperCase() + minTier.slice(1);
    return { allowed: false, error: `This feature requires the ${label} plan or higher.` };
  }
  return { allowed: true };
}

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
      '❌ Anthropic auth failed — set ANTHROPIC_API_KEY in the environment where you run pnpm dev:command-center'
    );
    return;
  }
  console.error('❌ Agent task failed:', err);
}

/** Run one admin task at a time so events and status stay coherent. */
let adminTaskChain: Promise<void> = Promise.resolve();

function queueAgentTask(task: Parameters<AdminAgent['run']>[0]) {
  adminTaskChain = adminTaskChain.then(() => agent.run(task)).catch(logAgentTaskError);
  return task;
}

/** Run one content task at a time. */
let contentTaskChain: Promise<void> = Promise.resolve();

/** Run one research task at a time. */
let researchTaskChain: Promise<void> = Promise.resolve();

function queueResearchTask(task: Parameters<ResearchAgent['run']>[0]) {
  researchTaskChain = researchTaskChain
    .then(() => researchAgent.run(task))
    .catch(logAgentTaskError);
  return task;
}

function queueContentTask(task: Parameters<ContentAgent['run']>[0]) {
  contentTaskChain = contentTaskChain.then(() => contentAgent.run(task)).catch(logAgentTaskError);
  return task;
}

/** Run one ops (NixOps) task at a time. */
let opsTaskChain: Promise<void> = Promise.resolve();

function queueOpsTask(task: Parameters<NixOpsAgent['run']>[0]) {
  opsTaskChain = opsTaskChain.then(() => opsAgent.run(task)).catch(logAgentTaskError);
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
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    approval = new ApprovalQueue(DB_PATH);
    memory = new MemoryStore(DB_PATH);
    trendpostStorage = new TrendPostStorage(DB_PATH);
    licenseDb = new Database(DB_PATH);
    licenseDb.exec(`
      CREATE TABLE IF NOT EXISTS licenses (
        key TEXT PRIMARY KEY,
        tier TEXT NOT NULL DEFAULT 'trial',
        status TEXT NOT NULL DEFAULT 'inactive',
        customer_email TEXT,
        activations_remaining INTEGER,
        verified_at TEXT NOT NULL,
        expires_grace_at TEXT NOT NULL
      )
    `);
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
  sseClients.forEach((send) => send(data));
}

// Wire EventBus → SSE broadcasts
events.on('agent:task_started', (p) => broadcast('task_started', p));
events.on('agent:task_complete', (p) => broadcast('task_complete', p));
events.on('agent:task_failed', (p) => broadcast('task_failed', p));
events.on('agent:waiting_approval', (p) => broadcast('waiting_approval', p));
events.on('agent:approval_resolved', (p) => broadcast('approval_resolved', p));
events.on('agent:triage_complete', (p) => broadcast('triage_complete', p));
events.on('agent:calendar_review_complete', (p) => broadcast('calendar_review_complete', p));
events.on('agent:freeform_response', (p) => broadcast('freeform_response', p));
events.on('agent:content_generated', (p) => broadcast('content_generated', p));
events.on('agent:content_approved', (p) => broadcast('content_approved', p));
events.on('agent:content_plan_generated', (p) => broadcast('content_plan_generated', p));
events.on('agent:post_scheduled', (p) => broadcast('post_scheduled', p));
events.on('agent:content_analyzed', (p) => broadcast('content_analyzed', p));
events.on('agent:scheduled_posts', (p) => broadcast('scheduled_posts', p));
events.on('agent:research_complete', (p) => broadcast('research_complete', p));
events.on('agent:ops_stage_complete', (p) => broadcast('ops_stage_complete', p));
events.on('agent:ops_blocked', (p) => broadcast('ops_blocked', p));
events.on('agent:ops_run_complete', (p) => broadcast('ops_run_complete', p));
events.on('agent:ops_freeform_response', (p) => broadcast('ops_freeform_response', p));

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function bootstrap() {
  openStores();

  // Content Agent tools
  registerTrendPostTools(mcp, trendpostStorage);
  contentAgent = new ContentAgent({ approval, memory, mcp, events });

  // Research Agent tools
  setupResearchMCP(mcp);
  researchAgent = new ResearchAgent({ approval, memory, mcp, events });

  // NixOps Agent — business workflow runner (context files ship with the package)
  opsAgent = new NixOpsAgent({ approval, memory, mcp, events });

  // Admin Agent tools — may fail if Gmail credentials are absent; surface a warning but continue
  try {
    await setupAdminMCP(mcp);
    agent = new AdminAgent({ approval, memory, mcp, events });
  } catch (err) {
    console.warn(
      '⚠️  Admin Agent unavailable (Gmail/Calendar credentials missing or invalid).',
      err instanceof Error ? err.message : err
    );
  }

  agentReady = true;
  if (!anthropicConfigured()) {
    console.warn(
      '⚠️  ANTHROPIC_API_KEY is not set — dashboard loads, but triage/chat/calendar tasks will fail until you export it.'
    );
  }
  console.log('✅ WireAssist API server ready');
}

// ── Hono app ───────────────────────────────────────────────────────────────
const app = new Hono();

app.use('*', cors({ origin: 'http://localhost:3001' }));
registerPortfolioRoutes(app, DB_PATH);

// Health check
app.get('/health', (c) =>
  c.json({ status: 'ok', agentReady, anthropicConfigured: anthropicConfigured() })
);

// ── AGENT STATUS ──────────────────────────────────────────────────────────
app.get('/api/agent/status', (c) => {
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
    research: {
      role: 'research',
      name: 'Research Agent',
      status: researchAgent?.status ?? 'idle',
    },
    ops: {
      role: 'strategy',
      name: 'NixOps',
      status: opsAgent?.status ?? 'idle',
    },
  });
});

// Recent agent events (for activity feed on load / missed SSE)
app.get('/api/activity', (c) => {
  const taskId = c.req.query('taskId');
  if (!taskId) return c.json(recentActivity);
  const filtered = recentActivity.filter((r) => {
    const p = r.payload as { taskId?: string };
    return p?.taskId === taskId;
  });
  return c.json(filtered);
});

// ── APPROVAL QUEUE ────────────────────────────────────────────────────────
app.get('/api/approvals', (c) => {
  if (!agentReady) return c.json([]);
  return c.json(approval.getPending());
});

app.post('/api/approvals/:id/approve', (c) => {
  const { id } = c.req.param();
  approval.resolve(id, true);
  broadcast('approval_resolved', { id, approved: true });
  return c.json({ ok: true });
});

app.post('/api/approvals/:id/reject', (c) => {
  const { id } = c.req.param();
  approval.resolve(id, false);
  broadcast('approval_resolved', { id, approved: false });
  return c.json({ ok: true });
});

function adminAgentRequired() {
  return {
    error:
      'Admin Agent unavailable — Gmail/Calendar credentials are not configured. See docs/SETUP.md.',
  };
}

// ── TASKS ─────────────────────────────────────────────────────────────────
app.post('/api/tasks/triage-email', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!agent) return c.json(adminAgentRequired(), 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const task = AdminTasks.triageEmail(20);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/review-calendar', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!agent) return c.json(adminAgentRequired(), 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const task = AdminTasks.reviewCalendar(body.daysAhead ?? 7);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!agent) return c.json(adminAgentRequired(), 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { instruction } = await c.req.json();
  if (!instruction) return c.json({ error: 'instruction required' }, 400);
  const task = AdminTasks.freeform(instruction);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── CONTENT TASKS ─────────────────────────────────────────────────────────
const VALID_PLATFORMS = new Set(['twitter', 'linkedin', 'instagram', 'threads']);

function isValidPlatform(p: unknown): p is 'twitter' | 'linkedin' | 'instagram' | 'threads' {
  return typeof p === 'string' && VALID_PLATFORMS.has(p);
}

app.post('/api/tasks/generate-post', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const tg = tierGate('operator');
  if (!tg.allowed) return c.json({ error: tg.error }, 403);
  const { topic, platform, tone } = await c.req.json();
  if (!topic || typeof topic !== 'string') return c.json({ error: 'topic required' }, 400);
  if (!isValidPlatform(platform)) {
    return c.json({ error: `platform must be one of: ${[...VALID_PLATFORMS].join(', ')}` }, 400);
  }
  if (tone !== undefined && (typeof tone !== 'string' || tone.length > 100)) {
    return c.json({ error: 'tone must be a string under 100 characters' }, 400);
  }
  const task = ContentTasks.generatePost(topic, platform, tone);
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/generate-plan', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const tg = tierGate('operator');
  if (!tg.allowed) return c.json({ error: tg.error }, 403);
  const body = await c.req.json().catch(() => ({}));
  const platforms: unknown[] = Array.isArray(body.platforms)
    ? body.platforms
    : ['linkedin', 'twitter'];
  const invalidPlatform = platforms.find((p) => !isValidPlatform(p));
  if (invalidPlatform) {
    return c.json(
      {
        error: `invalid platform "${invalidPlatform}". Must be one of: ${[...VALID_PLATFORMS].join(', ')}`,
      },
      400
    );
  }
  const task = ContentTasks.generatePlan(
    platforms as ('twitter' | 'linkedin' | 'instagram' | 'threads')[],
    body.weeksAhead ?? 1,
    body.postsPerWeek ?? 3
  );
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── RESEARCH TASKS ────────────────────────────────────────────────────────
app.post('/api/tasks/research-topic', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const tg = tierGate('workforce');
  if (!tg.allowed) return c.json({ error: tg.error }, 403);
  const { query, depth } = await c.req.json();
  if (!query || typeof query !== 'string') return c.json({ error: 'query required' }, 400);
  const task = ResearchTasks.researchTopic(query, depth === 'deep' ? 'deep' : 'quick');
  queueResearchTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/synthesize', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const tg = tierGate('workforce');
  if (!tg.allowed) return c.json({ error: tg.error }, 403);
  const { topic } = await c.req.json();
  if (!topic || typeof topic !== 'string') return c.json({ error: 'topic required' }, 400);
  const task = ResearchTasks.synthesizeFindings(topic);
  queueResearchTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── OPS (NIXOPS) TASKS ────────────────────────────────────────────────────
app.get('/api/ops/workflows', (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  return c.json({ workflows: opsAgent.workflows() });
});

app.post('/api/tasks/ops-workflow', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const tg = tierGate('workforce');
  if (!tg.allowed) return c.json({ error: tg.error }, 403);
  const { workflow, brief } = await c.req.json();
  if (!workflow || typeof workflow !== 'string') return c.json({ error: 'workflow required' }, 400);
  if (!brief || typeof brief !== 'string') return c.json({ error: 'brief required' }, 400);
  const task = OpsTasks.createWorkflowRunTask({ workflow, brief });
  queueOpsTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/ops-freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const tg = tierGate('workforce');
  if (!tg.allowed) return c.json({ error: tg.error }, 403);
  const { prompt } = await c.req.json();
  if (!prompt || typeof prompt !== 'string') return c.json({ error: 'prompt required' }, 400);
  const task = OpsTasks.createOpsFreeformTask({ prompt });
  queueOpsTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── LICENSE ───────────────────────────────────────────────────────────────
app.get('/api/license/status', (c) => {
  return c.json({ tier: currentTier() });
});

app.post('/api/license/activate', async (c) => {
  const { key } = (await c.req.json()) as { key?: string };
  if (!key || typeof key !== 'string' || !key.trim()) {
    return c.json({ error: 'key required' }, 400);
  }

  if (!licenseDb) {
    return c.json({ error: 'License store not available' }, 503);
  }

  const lsApiKey = process.env.LS_API_KEY;
  if (!lsApiKey) {
    return c.json({ error: 'LS_API_KEY not configured on this server' }, 503);
  }

  let tier = 'unknown';
  let status = 'inactive';
  let customerEmail: string | null = null;
  let activationsRemaining: number | null = null;

  try {
    const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/validate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lsApiKey}`,
      },
      body: JSON.stringify({ license_key: key.trim() }),
    });
    const data = (await res.json()) as {
      valid?: boolean;
      license_key?: { status: string; activation_limit: number; activations_count: number };
      meta?: { customer_email: string; variant_id: number };
      error?: string;
    };

    if (!data.valid) {
      return c.json({ error: data.error ?? 'Invalid license key' }, 400);
    }

    status = data.license_key?.status ?? 'active';
    customerEmail = data.meta?.customer_email ?? null;
    const variantId = String(data.meta?.variant_id ?? '');
    activationsRemaining = data.license_key
      ? data.license_key.activation_limit - data.license_key.activations_count
      : null;

    if (variantId === (process.env.LS_VARIANT_WORKFORCE ?? '')) tier = 'workforce';
    else if (variantId === (process.env.LS_VARIANT_OPERATOR ?? '')) tier = 'operator';
    else if (variantId === (process.env.LS_VARIANT_SOLO ?? '')) tier = 'solo';
    else tier = 'solo'; // fallback for any valid key
  } catch (err) {
    console.error('[license] LemonSqueezy API error:', err);
    return c.json({ error: 'Failed to reach LemonSqueezy API' }, 503);
  }

  const now = new Date().toISOString();
  const grace = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    licenseDb
      .prepare(
        `
    INSERT INTO licenses (key, tier, status, customer_email, activations_remaining, verified_at, expires_grace_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      tier = excluded.tier, status = excluded.status,
      customer_email = excluded.customer_email,
      activations_remaining = excluded.activations_remaining,
      verified_at = excluded.verified_at,
      expires_grace_at = excluded.expires_grace_at
  `
      )
      .run(key.trim(), tier, status, customerEmail, activationsRemaining, now, grace);
  } catch (err) {
    console.error('[license] failed to persist license:', err);
    return c.json({ error: 'Failed to store license' }, 503);
  }

  return c.json({ tier, status, activationsRemaining });
});

// ── CONTENT DATA ──────────────────────────────────────────────────────────
app.get('/api/content/posts', (c) => {
  if (!agentReady) return c.json([]);
  const raw = parseInt(c.req.query('daysAhead') ?? '14', 10);
  const daysAhead = Number.isFinite(raw) && raw > 0 ? raw : 14;
  const now = new Date();
  return c.json(
    trendpostStorage.listPosts({
      from: now,
      to: new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000),
    })
  );
});

app.get('/api/content/ideas', (c) => {
  if (!agentReady) return c.json([]);
  return c.json(trendpostStorage.listIdeas());
});

// ── MEMORY ────────────────────────────────────────────────────────────────
app.get('/api/memory', async (c) => {
  const query = (c.req.query('q') ?? '').trim();
  if (!query) return c.json(memory.listRecent());
  return c.json(await memory.searchAsync(query));
});

app.post('/api/memory/upgrade-embeddings', async (c) => {
  if (!agentReady) return c.json({ error: 'not ready' }, 503);
  const result = await memory.upgradeEmbeddings();
  return c.json(result);
});

app.post('/api/memory/onboard', async (c) => {
  if (!agentReady) return c.json({ error: 'not ready' }, 503);
  const body = (await c.req.json().catch(() => ({}))) as { answers?: Record<string, string> };
  const { answers } = body;
  if (!answers || typeof answers !== 'object') {
    return c.json({ error: 'answers object required' }, 400);
  }
  let stored = 0;
  for (const [question, answer] of Object.entries(answers)) {
    if (typeof answer === 'string' && answer.trim()) {
      await memory.storeAsync({
        content: `${question}: ${answer.trim()}`,
        agentRole: 'admin',
        tags: ['onboarding'],
        createdAt: new Date(),
      });
      stored++;
    }
  }
  return c.json({ ok: true, stored });
});

// ── SSE STREAM ────────────────────────────────────────────────────────────
app.get('/api/events', (c) => {
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
      Connection: 'keep-alive',
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
        `   Or use another port: API_PORT=3003 pnpm dev:api`
    );
    process.exit(1);
  }
  throw err;
});
