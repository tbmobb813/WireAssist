import './load-env';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ApprovalQueue,
  MemoryStore,
  MCPClient,
  EventBus,
  type AgentRole,
  type AgentTask,
  type ImageAttachment,
  type DocumentAttachment,
} from '@wireassist/core';
import { logger } from '@wireassist/core/logger';
import {
  AdminAgent,
  setupAdminMCP,
  AdminTasks,
  budgetTracker,
  listAutoApproveRecords,
  setAutoApproveOverride,
  GmailClient,
} from '@wireassist/agent-admin';
import { ContentAgent, ContentTasks } from '@wireassist/agent-content';
import { ResearchAgent, ResearchTasks, setupResearchMCP } from '@wireassist/agent-research';
import {
  NixOpsAgent,
  OpsTasks,
  loadWorkflow,
  getTrustStage,
  setTrustStage,
  MIN_TRUST_STAGE,
  MAX_TRUST_STAGE,
  getWorkflowSettings,
  setWorkflowSettings,
  applyWorkflowSettings,
  setupOpsMCP,
  registerWordPressTools,
  registerImageTools,
  registerYouTubeTools,
} from '@wireassist/agent-ops';
import {
  GtmAgent,
  GtmTasks,
  prefillFromRepoDoc,
  type GtmProductInput,
} from '@wireassist/agent-gtm';
import {
  GitHubAgent,
  GitHubTasks,
  GitHubMcpClient,
  resolveAuthorizedGithubTools,
} from '@wireassist/agent-github';
import { registerTrendPostTools, TrendPostStorage } from '@wireassist/trendpost-mcp';
import { registerPortfolioRoutes } from './portfolio-routes';
import { registerObjectiveRoutes } from './objective-routes';
import { registerConversationRoutes } from './conversation-routes';
import { routeChatMessage, type RouteDecision, type ChatHistoryMessage } from './chat-router';
import { getLocation, setLocation, listNotes, addNote, deleteNote } from './dashboard-widgets';
import { routeHandoffTask } from '../lib/route-handoff';

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
let gtmAgent: GtmAgent;
let githubAgent: GitHubAgent | undefined;
let githubReady = false;
let trendpostStorage: TrendPostStorage;
let agentReady = false;
let gmailReady = false;
// Timestamp (ms) of the token's own refreshTokenExpiresAt value at the time
// we last sent a warning — reset to null on a successful re-auth, so a new
// token (with its own later expiry) can trigger a fresh warning cycle
// instead of being permanently silenced by the old one.
let gmailReauthWarnedAt: number | null = null;

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
    logger.error(
      '❌ Anthropic auth failed — set ANTHROPIC_API_KEY in the environment where you run pnpm dev:command-center'
    );
    return;
  }
  logger.error('❌ Agent task failed:', err);
}

/** Run one admin task at a time so events and status stay coherent. */
let adminTaskChain: Promise<void> = Promise.resolve();

// Emitted before a task is handed to its agent's serialized queue — the
// only signal a task exists prior to actually starting (there's no other
// "queued" event anywhere in the codebase). Unconditional, same as
// BaseAgent.run()'s own emits; broadcast() is what gates the ledger write
// on objectiveId presence, not the emit itself.
function emitTaskQueued(task: AgentTask) {
  events.emit('agent:task_queued', {
    agentRole: task.agentRole,
    taskId: task.id,
    description: task.description,
    objectiveId: task.objectiveId,
  });
}

function queueAgentTask(task: Parameters<AdminAgent['run']>[0]) {
  emitTaskQueued(task);
  adminTaskChain = adminTaskChain.then(() => agent.run(task)).catch(logAgentTaskError);
  return task;
}

/** Run one content task at a time. */
let contentTaskChain: Promise<void> = Promise.resolve();

/** Run one research task at a time. */
let researchTaskChain: Promise<void> = Promise.resolve();

function queueResearchTask(task: Parameters<ResearchAgent['run']>[0]) {
  emitTaskQueued(task);
  researchTaskChain = researchTaskChain
    .then(() => researchAgent.run(task))
    .catch(logAgentTaskError);
  return task;
}

function queueContentTask(task: Parameters<ContentAgent['run']>[0]) {
  emitTaskQueued(task);
  contentTaskChain = contentTaskChain.then(() => contentAgent.run(task)).catch(logAgentTaskError);
  return task;
}

/** Run one ops (NixOps) task at a time. */
let opsTaskChain: Promise<void> = Promise.resolve();

function queueOpsTask(task: Parameters<NixOpsAgent['run']>[0]) {
  emitTaskQueued(task);
  opsTaskChain = opsTaskChain.then(() => opsAgent.run(task)).catch(logAgentTaskError);
  return task;
}

/** Run one GTM task at a time. */
let gtmTaskChain: Promise<void> = Promise.resolve();

function queueGtmTask(task: Parameters<GtmAgent['run']>[0]) {
  emitTaskQueued(task);
  gtmTaskChain = gtmTaskChain.then(() => gtmAgent.run(task)).catch(logAgentTaskError);
  return task;
}

/** Run one GitHub task at a time. */
let githubTaskChain: Promise<void> = Promise.resolve();

function queueGithubTask(task: Parameters<GitHubAgent['run']>[0]) {
  if (!githubAgent) {
    logger.error(
      'GitHub task queued but the GitHub agent never connected — dropping task',
      task.id
    );
    return task;
  }
  const agent = githubAgent;
  emitTaskQueued(task);
  githubTaskChain = githubTaskChain.then(() => agent.run(task)).catch(logAgentTaskError);
  return task;
}

// GitHubMcpClient.callTool() returns MCP's array-of-content-blocks shape
// ([{ type: 'text', text: '...' }]) — extract the first text block, parse it
// as JSON, and normalize to a flat repo list. Field names aren't verified
// live yet (SSH to the VPS is unreachable from this sandbox), so this
// defensively accepts both GitHub REST-style snake_case and camelCase keys
// rather than assuming one exact shape.
interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  private: boolean;
}

function parseRepoSearchResult(raw: unknown): RepoSummary[] {
  const blocks = Array.isArray(raw) ? raw : [];
  const textBlock = blocks.find(
    (b): b is { type: string; text: string } =>
      typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text'
  );
  if (!textBlock) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return [];
  }

  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { items?: unknown[] })?.items)
      ? (parsed as { items: unknown[] }).items
      : Array.isArray((parsed as { repositories?: unknown[] })?.repositories)
        ? (parsed as { repositories: unknown[] }).repositories
        : [];

  return items
    .map((item) => {
      const r = item as Record<string, unknown>;
      const fullName = (r.full_name ?? r.fullName ?? r.name ?? '') as string;
      const url = (r.html_url ?? r.htmlUrl ?? r.url ?? '') as string;
      if (!fullName || !url) return null;
      return {
        id: String(r.id ?? fullName),
        name: (r.name ?? fullName.split('/').pop() ?? fullName) as string,
        fullName,
        url,
        description: (r.description ?? null) as string | null,
        private: Boolean(r.private ?? r.isPrivate ?? false),
      };
    })
    .filter((r): r is RepoSummary => r !== null);
}

// GitHubMcpClient.callTool() returns MCP's array-of-content-blocks shape —
// extract the first text block, parse it as JSON, and normalize to a flat
// PR list. Same defensive snake_case/camelCase handling as
// parseRepoSearchResult() above, since field names aren't verified live in
// this sandbox (no GitHub credentials configured here).
interface PrSummary {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
}

function parsePrListResult(raw: unknown): PrSummary[] {
  const blocks = Array.isArray(raw) ? raw : [];
  const textBlock = blocks.find(
    (b): b is { type: string; text: string } =>
      typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text'
  );
  if (!textBlock) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return [];
  }

  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { items?: unknown[] })?.items)
      ? (parsed as { items: unknown[] }).items
      : [];

  return items
    .map((item) => {
      const pr = item as Record<string, unknown>;
      const number = pr.number as number | undefined;
      const url = (pr.html_url ?? pr.htmlUrl ?? pr.url ?? '') as string;
      const updatedAt = (pr.updated_at ?? pr.updatedAt ?? '') as string;
      if (typeof number !== 'number' || !url || !updatedAt) return null;
      return { number, title: (pr.title ?? '') as string, url, updatedAt };
    })
    .filter((pr): pr is PrSummary => pr !== null);
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
  } catch (err) {
    logger.error(`❌ ${sqliteSetupHint()}`);
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

function pushSSE(event: string, payload: unknown) {
  const data = `data: ${JSON.stringify({ event, payload })}\n\n`;
  sseClients.forEach((send) => send(data));
}

function broadcast(event: string, payload: unknown) {
  recentActivity.unshift({ event, payload, at: new Date().toISOString() });
  if (recentActivity.length > MAX_ACTIVITY) recentActivity.pop();

  const objectiveId = (payload as { objectiveId?: string } | undefined)?.objectiveId;
  if (objectiveId) {
    objectiveStore
      .recordAgentEvent(`agent.${event}`, objectiveId, payload as Record<string, unknown>)
      .catch((e) => logger.error(e));
  }

  pushSSE(event, payload);
}

// Wire EventBus → SSE broadcasts
events.on('agent:task_queued', (p) => broadcast('task_queued', p));
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
events.on('agent:trust_graduation_nudges_complete', (p) =>
  broadcast('trust_graduation_nudges_complete', p)
);
events.on('agent:ops_published', (p) => broadcast('ops_published', p));
events.on('agent:gmail_reauth_needed', (p) => broadcast('gmail_reauth_needed', p));
events.on('agent:ops_publish_failed', (p) => broadcast('ops_publish_failed', p));
events.on('agent:gtm_generated', (p) => broadcast('gtm_generated', p));
events.on('agent:gtm_psych_generated', (p) => broadcast('gtm_psych_generated', p));
events.on('agent:github_freeform_response', (p) => broadcast('github_freeform_response', p));
events.on('agent:auto_approved', (p) => broadcast('auto_approved', p));
events.on('agent:daily_briefing_complete', (p) => broadcast('daily_briefing_complete', p));
events.on('agent:follow_up_nudges_complete', (p) => broadcast('follow_up_nudges_complete', p));
events.on('agent:proactive_insights_complete', (p) => broadcast('proactive_insights_complete', p));
events.on('agent:budget_warning_complete', (p) => broadcast('budget_warning_complete', p));
events.on('agent:stale_approvals_complete', (p) => broadcast('stale_approvals_complete', p));
events.on('agent:stale_prs_complete', (p) => broadcast('stale_prs_complete', p));
events.on('agent:objective_health_check_complete', (p) =>
  broadcast('objective_health_check_complete', p)
);
events.on('agent:publish_due_posts_complete', (p) => broadcast('publish_due_posts_complete', p));
events.on('agent:post_published', (p) => broadcast('post_published', p));

// Agent-to-agent handoff: a skill (e.g. Research's research_topic, once its
// own approval for the handoff is granted) hands a fully-formed AgentTask
// for another agent to run. Routed by task.agentRole to that agent's own
// serialized queue — generic by construction, not specific to Research ->
// Content, so future handoffs to any agent reuse this unchanged.
events.on('agent:handoff_requested', (p) => {
  const { task } = p as { task: AgentTask };
  const routed = routeHandoffTask(task, {
    content: (t) => queueContentTask(t as Parameters<ContentAgent['run']>[0]),
    research: (t) => queueResearchTask(t as Parameters<ResearchAgent['run']>[0]),
    strategy: (t) => queueOpsTask(t as Parameters<NixOpsAgent['run']>[0]),
    gtm: (t) => queueGtmTask(t as Parameters<GtmAgent['run']>[0]),
    github: (t) => queueGithubTask(t as Parameters<GitHubAgent['run']>[0]),
    admin: (t) => queueAgentTask(t as Parameters<AdminAgent['run']>[0]),
  });
  if (routed) broadcast('handoff_queued', p);
});

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
  setupOpsMCP(mcp);
  registerWordPressTools(mcp);
  registerImageTools(mcp);
  registerYouTubeTools(mcp);
  opsAgent = new NixOpsAgent({ approval, memory, mcp, events });

  // GTM Agent — go-to-market strategy and psych tactics generation
  gtmAgent = new GtmAgent({ approval, memory, mcp, events });

  // GitHub Dev Agent — real MCP client against GitHub's hosted MCP server
  // (the first agent in this codebase to speak the actual Model Context
  // Protocol rather than WireAssist's own internal tool registry). Connection
  // must succeed before toolSchemas can be built (the tool catalog is fetched
  // live via tools/list), so — like Gmail/Calendar — this degrades gracefully:
  // GitHub tools unavailable but the rest of the app still boots if the PAT
  // is missing/invalid or the network is down.
  try {
    const githubClient = new GitHubMcpClient();
    await githubClient.connect();
    const authorizedTools = resolveAuthorizedGithubTools(await githubClient.listRemoteTools());
    githubAgent = new GitHubAgent({ approval, memory, mcp, events, githubClient, authorizedTools });
    githubReady = true;
  } catch (err) {
    logger.warn(
      '⚠️  GitHub agent unavailable (credentials missing/invalid or MCP connection failed). Other agents still work.',
      err instanceof Error ? err.message : err
    );
  }

  // Admin Agent — always constructed so freeform chat works without Gmail/Calendar
  // credentials. Gmail/Calendar tools register separately below; email/calendar-
  // specific tasks are gated on gmailReady, not on the agent's existence.
  agent = new AdminAgent({ approval, memory, mcp, events });
  try {
    await setupAdminMCP(mcp);
    gmailReady = true;
  } catch (err) {
    logger.warn(
      '⚠️  Gmail/Calendar tools unavailable (credentials missing or invalid). Chat still works; email/calendar tasks will fail until configured.',
      err instanceof Error ? err.message : err
    );
  }

  agentReady = true;
  if (!anthropicConfigured()) {
    logger.warn(
      '⚠️  ANTHROPIC_API_KEY is not set — dashboard loads, but triage/chat/calendar tasks will fail until you export it.'
    );
  }

  checkGmailReauthExpiry();
  setInterval(checkGmailReauthExpiry, GMAIL_REAUTH_CHECK_INTERVAL_MS);

  logger.info('✅ WireAssist API server ready');
}

// Testing-mode Google OAuth refresh tokens die in days, not indefinitely
// (see GmailClient.getTokenStatus()) — this fires a one-time warning per
// token once it's within GMAIL_REAUTH_WARNING_THRESHOLD_DAYS of expiry
// (and again immediately if it's *already* expired, e.g. right at boot),
// so JNix gets a Telegram nudge with a tap-to-fix link before Gmail/Calendar
// silently breaks. Read-only — never itself alters gmailReady.
const GMAIL_REAUTH_WARNING_THRESHOLD_DAYS = 1.5;
const GMAIL_REAUTH_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function checkGmailReauthExpiry(): void {
  const redirectUri = process.env.WIREASSIST_OAUTH_REDIRECT_URI;
  if (!redirectUri) return; // no headless re-auth route configured — nothing actionable to send

  let status: { refreshTokenExpiresAt: number; daysRemaining: number } | null;
  try {
    status = GmailClient.getTokenStatus();
  } catch {
    return;
  }
  if (!status || status.daysRemaining > GMAIL_REAUTH_WARNING_THRESHOLD_DAYS) return;
  if (gmailReauthWarnedAt === status.refreshTokenExpiresAt) return; // already warned for this token

  gmailReauthWarnedAt = status.refreshTokenExpiresAt;
  let url: string;
  try {
    url = new GmailClient().generateWebAuthUrl(redirectUri);
  } catch {
    return;
  }
  events.emit('agent:gmail_reauth_needed', {
    daysRemaining: status.daysRemaining,
    expired: status.daysRemaining <= 0,
    url,
  });
}

// ── Hono app ───────────────────────────────────────────────────────────────
const app = new Hono();

app.use('*', cors({ origin: 'http://localhost:3001' }));
const portfolioStore = registerPortfolioRoutes(app, DB_PATH);
const objectiveStore = registerObjectiveRoutes(app, DB_PATH, pushSSE);
registerConversationRoutes(app, DB_PATH);

// Health check
app.get('/health', (c) =>
  c.json({ status: 'ok', agentReady, gmailReady, anthropicConfigured: anthropicConfigured() })
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
    gtm: {
      role: 'gtm',
      name: 'GTM Agent',
      status: gtmAgent?.status ?? 'idle',
    },
    github: {
      role: 'github',
      name: 'GitHub Dev Agent',
      status: githubAgent?.status ?? 'idle',
      ready: githubReady,
    },
  });
});

// Deterministic (non-LLM) repo list for UI pickers — bypasses the GitHub
// agent's chat/tool-loop entirely via callReadOnlyTool().
app.get('/api/github/repos', async (c) => {
  if (!githubAgent || !githubReady) {
    return c.json({ error: 'GitHub agent not connected', repos: [] }, 503);
  }
  try {
    const owner = process.env.GITHUB_USERNAME ?? 'tbmobb813';
    const raw = await githubAgent.callReadOnlyTool('search_repositories', {
      query: `user:${owner}`,
      perPage: 100,
    });
    return c.json({ repos: parseRepoSearchResult(raw) });
  } catch (err) {
    logger.error('GitHub repo list failed', err instanceof Error ? err.message : err);
    return c.json({ error: 'Failed to list GitHub repos', repos: [] }, 502);
  }
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

function gmailRequired() {
  return {
    error: 'Gmail/Calendar credentials are not configured. See docs/SETUP.md.',
  };
}

// ── TASKS ─────────────────────────────────────────────────────────────────
app.post('/api/tasks/triage-email', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!gmailReady) return c.json(gmailRequired(), 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const task = AdminTasks.triageEmail(
    20,
    typeof body.objectiveId === 'string' ? body.objectiveId : undefined
  );
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/review-calendar', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!gmailReady) return c.json(gmailRequired(), 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const task = AdminTasks.reviewCalendar(
    body.daysAhead ?? 7,
    typeof body.objectiveId === 'string' ? body.objectiveId : undefined
  );
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/daily-briefing', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!gmailReady) return c.json(gmailRequired(), 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const task = AdminTasks.dailyBriefing(body.maxEmails ?? 20, body.daysAhead ?? 7);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/follow-up-nudges', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!gmailReady) return c.json(gmailRequired(), 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const task = AdminTasks.followUpNudges(body.daysStale ?? 3);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/proactive-insights', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const task = AdminTasks.proactiveInsights();
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// No anthropicConfigured() gate here, unlike the other proactive-nudge
// routes above — budget_warning_nudge only does arithmetic on the already-
// computed BudgetStatus, never an agent.think() call, so it works even
// before an Anthropic key is configured.
app.post('/api/tasks/budget-warning', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  const body = await c.req.json().catch(() => ({}));
  // A non-numeric/negative value would otherwise silently make `percent >=
  // threshold` always false (or always true for negatives) — fall back to
  // the default instead of warning on garbage input.
  const thresholdPercent =
    Number.isFinite(body.thresholdPercent) && body.thresholdPercent >= 0
      ? body.thresholdPercent
      : 80;
  const task = AdminTasks.budgetWarning(thresholdPercent);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/stale-approvals', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const daysStale = Number.isFinite(body.daysStale) && body.daysStale >= 0 ? body.daysStale : 3;
  const task = AdminTasks.staleApprovals(daysStale);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// No anthropicConfigured() gate — the summary is a fixed template, not
// think()-phrased (see objective-health-check.ts), so it works even before
// an Anthropic key is configured, matching publish_due_posts' precedent.
app.post('/api/tasks/objective-health-check', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  const body = await c.req.json().catch(() => ({}));
  const daysStale = Number.isFinite(body.daysStale) && body.daysStale >= 0 ? body.daysStale : 5;
  const activeObjectives = await objectiveStore.listObjectives({ status: 'active' });
  const objectives = await Promise.all(
    activeObjectives.map(async (o) => {
      const [latest] = await objectiveStore.listEvents({ objectiveId: o.id, limit: 1 });
      return { id: o.id, title: o.title, latestEventAt: latest?.createdAt ?? null };
    })
  );
  const task = AdminTasks.objectiveHealthCheck(objectives, daysStale);
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// No anthropicConfigured() gate — publish_due_posts never calls the LLM,
// it's a mechanical sweep over already-approved scheduled posts (the
// approval gate was scheduling itself), so it works even before an
// Anthropic key is configured.
app.post('/api/tasks/publish-due-posts', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  const task = ContentTasks.publishDuePosts();
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// Raw upcoming events for the dashboard's calendar widget — no LLM analysis,
// just the next few events, so it's cheap enough to poll.
app.get('/api/calendar/upcoming', async (c) => {
  if (!gmailReady) return c.json({ ready: false, events: [] });
  try {
    const events = await mcp.call('calendar_list_events', {
      maxResults: 5,
      timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return c.json({ ready: true, events });
  } catch (err) {
    return c.json({
      ready: false,
      events: [],
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// ── DASHBOARD WIDGETS ─────────────────────────────────────────────────────
// Location for the weather chip — client geocodes and fetches weather
// directly against Open-Meteo (public, no key needed); this just persists
// the chosen coordinates so it survives a refresh/redeploy.
app.get('/api/dashboard/location', (c) => c.json({ location: getLocation() }));

app.post('/api/dashboard/location', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (
    typeof body?.lat !== 'number' ||
    typeof body?.lon !== 'number' ||
    typeof body?.label !== 'string'
  ) {
    return c.json({ error: 'Required: lat (number), lon (number), label (string)' }, 400);
  }
  setLocation({ lat: body.lat, lon: body.lon, label: body.label });
  return c.json({ ok: true });
});

app.get('/api/notes', (c) => c.json({ notes: listNotes() }));

app.post('/api/notes', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.text !== 'string' || !body.text.trim()) {
    return c.json({ error: 'Required: text (non-empty string)' }, 400);
  }
  return c.json({ note: addNote(body.text.trim()) }, 201);
});

app.delete('/api/notes/:id', (c) => {
  deleteNote(c.req.param('id'));
  return c.json({ ok: true });
});

// Caps and validates the client-supplied conversation transcript before it
// ever reaches an LLM call — defends against a tampered/oversized payload
// even though chat-router applies its own cap too.
const MAX_HISTORY_MESSAGES = 20;
function sanitizeHistory(raw: unknown): ChatHistoryMessage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const messages = raw.filter(
    (m): m is ChatHistoryMessage =>
      !!m &&
      typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string'
  );
  return messages.length > 0 ? messages.slice(-MAX_HISTORY_MESSAGES) : undefined;
}

// Same defense-in-depth as sanitizeHistory() — caps count and per-image
// base64 size (9 MB, a safety margin under Anthropic's 10 MB base64-encoded
// API limit) and drops anything malformed rather than erroring the whole
// request, since one bad attachment shouldn't block the rest of the message.
const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGE_BASE64_BYTES = 9 * 1024 * 1024;
const ALLOWED_IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function sanitizeImages(raw: unknown): ImageAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const images = raw.filter(
    (img): img is ImageAttachment =>
      !!img &&
      typeof img === 'object' &&
      typeof (img as ImageAttachment).mediaType === 'string' &&
      ALLOWED_IMAGE_MEDIA_TYPES.has((img as ImageAttachment).mediaType) &&
      typeof (img as ImageAttachment).data === 'string' &&
      (img as ImageAttachment).data.length > 0 &&
      (img as ImageAttachment).data.length <= MAX_IMAGE_BASE64_BYTES
  );
  return images.length > 0 ? images.slice(0, MAX_IMAGES_PER_MESSAGE) : undefined;
}

// Same defense-in-depth as sanitizeImages() — 30 MB is a safety margin under
// Anthropic's 32 MB base64-encoded PDF limit.
const MAX_DOCUMENTS_PER_MESSAGE = 4;
const MAX_DOCUMENT_BASE64_BYTES = 30 * 1024 * 1024;
const ALLOWED_DOCUMENT_MEDIA_TYPES = new Set(['application/pdf', 'text/plain']);
function sanitizeDocuments(raw: unknown): DocumentAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const documents = raw.filter(
    (doc): doc is DocumentAttachment =>
      !!doc &&
      typeof doc === 'object' &&
      typeof (doc as DocumentAttachment).mediaType === 'string' &&
      ALLOWED_DOCUMENT_MEDIA_TYPES.has((doc as DocumentAttachment).mediaType) &&
      typeof (doc as DocumentAttachment).data === 'string' &&
      (doc as DocumentAttachment).data.length > 0 &&
      (doc as DocumentAttachment).data.length <= MAX_DOCUMENT_BASE64_BYTES &&
      (doc.filename === undefined || typeof doc.filename === 'string')
  );
  return documents.length > 0 ? documents.slice(0, MAX_DOCUMENTS_PER_MESSAGE) : undefined;
}

app.post('/api/tasks/freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const {
    instruction,
    history: rawHistory,
    objectiveId: rawObjectiveId,
    images: rawImages,
    documents: rawDocuments,
  } = await c.req.json();
  if (!instruction) return c.json({ error: 'instruction required' }, 400);
  const history = sanitizeHistory(rawHistory);
  const images = sanitizeImages(rawImages);
  const documents = sanitizeDocuments(rawDocuments);
  const objectiveId =
    typeof rawObjectiveId === 'string' && rawObjectiveId ? rawObjectiveId : undefined;

  let decision: RouteDecision;
  try {
    decision = await routeChatMessage(instruction, history);
  } catch {
    decision = { kind: 'admin_freeform', prompt: instruction };
  }

  switch (decision.kind) {
    case 'admin_triage': {
      if (!gmailReady) return c.json(gmailRequired(), 503);
      const task = AdminTasks.triageEmail(20, objectiveId);
      queueAgentTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'admin_calendar': {
      if (!gmailReady) return c.json(gmailRequired(), 503);
      const task = AdminTasks.reviewCalendar(decision.daysAhead ?? 7, objectiveId);
      queueAgentTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'content_generate': {
      const task = ContentTasks.generatePost(
        decision.topic,
        decision.platform,
        decision.tone,
        objectiveId
      );
      queueContentTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'content_plan': {
      const task = ContentTasks.generatePlan(
        decision.platforms ?? ['linkedin', 'twitter'],
        decision.weeksAhead ?? 1,
        decision.postsPerWeek ?? 3,
        objectiveId
      );
      queueContentTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'content_freeform': {
      const task = ContentTasks.freeform(decision.prompt, history, objectiveId, images, documents);
      queueContentTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'research_topic': {
      const task = ResearchTasks.researchTopic(
        decision.query,
        decision.depth ?? 'quick',
        undefined,
        objectiveId,
        decision.offerOpsWorkflow ? { workflow: decision.offerOpsWorkflow } : undefined
      );
      queueResearchTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'research_freeform': {
      const task = ResearchTasks.freeform(decision.prompt, history, objectiveId, images, documents);
      queueResearchTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'ops_freeform': {
      const task = OpsTasks.createOpsFreeformTask({
        prompt: decision.prompt,
        history,
        objectiveId,
        images,
        documents,
      });
      queueOpsTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'ops_workflow': {
      const task = OpsTasks.createWorkflowRunTask({
        workflow: decision.workflow,
        brief: decision.brief,
        objectiveId,
      });
      queueOpsTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'gtm_freeform': {
      const task = GtmTasks.freeform(decision.prompt, history, objectiveId, images, documents);
      queueGtmTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'gtm_redirect':
      return c.json({
        redirect: '/gtm',
        message:
          'GTM strategy needs more detail than chat can capture — 16 fields covering your product, market, and business. Head to the GTM wizard to build a full plan.',
      });
    case 'github_freeform': {
      if (!githubReady) {
        return c.json(
          {
            error:
              'GitHub agent not configured — see docs/SETUP.md\'s "GitHub Dev Agent" section to set up a Personal Access Token.',
          },
          503
        );
      }
      const task = GitHubTasks.freeform(decision.prompt, history, objectiveId, images, documents);
      queueGithubTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
    case 'admin_freeform':
    default: {
      const task = AdminTasks.freeform(
        decision.kind === 'admin_freeform' ? decision.prompt : instruction,
        history,
        objectiveId,
        images,
        documents
      );
      queueAgentTask(task);
      return c.json({ taskId: task.id, status: 'queued' });
    }
  }
});

// ── CONTENT TASKS ─────────────────────────────────────────────────────────
const VALID_PLATFORMS = new Set(['twitter', 'linkedin', 'instagram', 'threads']);

function isValidPlatform(p: unknown): p is 'twitter' | 'linkedin' | 'instagram' | 'threads' {
  return typeof p === 'string' && VALID_PLATFORMS.has(p);
}

app.post('/api/tasks/generate-post', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { topic, platform, tone, context, objectiveId } = await c.req.json();
  if (!topic || typeof topic !== 'string') return c.json({ error: 'topic required' }, 400);
  if (!isValidPlatform(platform)) {
    return c.json({ error: `platform must be one of: ${[...VALID_PLATFORMS].join(', ')}` }, 400);
  }
  if (tone !== undefined && (typeof tone !== 'string' || tone.length > 100)) {
    return c.json({ error: 'tone must be a string under 100 characters' }, 400);
  }
  if (context !== undefined && (typeof context !== 'string' || context.length > 4000)) {
    return c.json({ error: 'context must be a string under 4000 characters' }, 400);
  }
  const task = ContentTasks.generatePost(
    topic,
    platform,
    tone,
    context || undefined,
    typeof objectiveId === 'string' ? objectiveId : undefined
  );
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/generate-plan', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
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
  if (
    body.businessContext !== undefined &&
    (typeof body.businessContext !== 'string' || body.businessContext.length > 4000)
  ) {
    return c.json({ error: 'businessContext must be a string under 4000 characters' }, 400);
  }
  const task = ContentTasks.generatePlan(
    platforms as ('twitter' | 'linkedin' | 'instagram' | 'threads')[],
    body.weeksAhead ?? 1,
    body.postsPerWeek ?? 3,
    body.businessContext || undefined,
    typeof body.objectiveId === 'string' ? body.objectiveId : undefined
  );
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/admin-freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const {
    prompt,
    history: rawHistory,
    objectiveId,
    images: rawImages,
    documents: rawDocuments,
  } = await c.req.json();
  if (!prompt || typeof prompt !== 'string') return c.json({ error: 'prompt required' }, 400);
  const task = AdminTasks.freeform(
    prompt,
    sanitizeHistory(rawHistory),
    typeof objectiveId === 'string' ? objectiveId : undefined,
    sanitizeImages(rawImages),
    sanitizeDocuments(rawDocuments)
  );
  queueAgentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/content-freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const {
    prompt,
    history: rawHistory,
    objectiveId,
    images: rawImages,
    documents: rawDocuments,
  } = await c.req.json();
  if (!prompt || typeof prompt !== 'string') return c.json({ error: 'prompt required' }, 400);
  const task = ContentTasks.freeform(
    prompt,
    sanitizeHistory(rawHistory),
    typeof objectiveId === 'string' ? objectiveId : undefined,
    sanitizeImages(rawImages),
    sanitizeDocuments(rawDocuments)
  );
  queueContentTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── RESEARCH TASKS ────────────────────────────────────────────────────────
app.post('/api/tasks/research-topic', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { query, depth, contentDraftPlatform, contentDraftTone, objectiveId } = await c.req.json();
  if (!query || typeof query !== 'string') return c.json({ error: 'query required' }, 400);
  const offerContentDraft = isValidPlatform(contentDraftPlatform)
    ? {
        platform: contentDraftPlatform,
        tone: typeof contentDraftTone === 'string' ? contentDraftTone : undefined,
      }
    : undefined;
  const task = ResearchTasks.researchTopic(
    query,
    depth === 'deep' ? 'deep' : 'quick',
    offerContentDraft,
    typeof objectiveId === 'string' ? objectiveId : undefined
  );
  queueResearchTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/synthesize', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { topic, objectiveId } = await c.req.json();
  if (!topic || typeof topic !== 'string') return c.json({ error: 'topic required' }, 400);
  const task = ResearchTasks.synthesizeFindings(
    topic,
    typeof objectiveId === 'string' ? objectiveId : undefined
  );
  queueResearchTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/research-freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const {
    prompt,
    history: rawHistory,
    objectiveId,
    images: rawImages,
    documents: rawDocuments,
  } = await c.req.json();
  if (!prompt || typeof prompt !== 'string') return c.json({ error: 'prompt required' }, 400);
  const task = ResearchTasks.freeform(
    prompt,
    sanitizeHistory(rawHistory),
    typeof objectiveId === 'string' ? objectiveId : undefined,
    sanitizeImages(rawImages),
    sanitizeDocuments(rawDocuments)
  );
  queueResearchTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── BUDGET ────────────────────────────────────────────────────────────────
app.get('/api/budget', (c) => {
  return c.json(budgetTracker.status());
});

// ── OPS (NIXOPS) TASKS ────────────────────────────────────────────────────
app.get('/api/ops/workflows', (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  return c.json({ workflows: opsAgent.workflows() });
});

// Preview a workflow's actual requirements before running it, so a brief can
// be written to satisfy the diagnose stage instead of guessing and hitting
// VERDICT: BLOCKED.
app.get('/api/ops/workflows/:name', (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  try {
    const name = c.req.param('name');
    return c.json({ workflow: name, content: applyWorkflowSettings(loadWorkflow(name), name) });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown workflow' }, 404);
  }
});

// Per-workflow trust stage (SOUL.md's trust ladder). Stage >=3 means this
// workflow's final approval gate is skipped — safe to trigger unattended by
// an external cron at that point (Stage 4 "heartbeat" is the same code path,
// just triggered by a scheduler instead of a human).
app.get('/api/ops/trust/:workflow', (c) => {
  return c.json({
    workflow: c.req.param('workflow'),
    stage: getTrustStage(c.req.param('workflow')),
  });
});

app.post('/api/ops/trust/:workflow', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const stage = Number(body.stage);
  if (!Number.isFinite(stage) || stage < MIN_TRUST_STAGE || stage > MAX_TRUST_STAGE) {
    return c.json(
      { error: `stage must be a number between ${MIN_TRUST_STAGE} and ${MAX_TRUST_STAGE}` },
      400
    );
  }
  const workflow = c.req.param('workflow');
  const saved = setTrustStage(workflow, stage);
  return c.json({ workflow, stage: saved });
});

// Shop-level constants a workflow needs (variant naming, cost sheets, style
// guides) — filled once here instead of re-typed on every run. Saving also
// rewrites the workflow file's own "_SETTING:_" placeholders with the real
// value (see workflow-settings.ts), so the DATA loop's Diagnose stage picks
// them up automatically with no other code changes.
app.get('/api/ops/settings/:workflow', (c) => {
  return c.json({
    workflow: c.req.param('workflow'),
    settings: getWorkflowSettings(c.req.param('workflow')),
  });
});

app.post('/api/ops/settings/:workflow', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
    return c.json({ error: 'values object required' }, 400);
  }
  const workflow = c.req.param('workflow');
  setWorkflowSettings(workflow, body.values);
  return c.json({ workflow, settings: getWorkflowSettings(workflow) });
});

// Admin Agent's narrow auto-approval policy — which senders have earned
// (or been manually granted/denied) auto-approval for ignore-labeling.
// See packages/agents/admin/src/auto-approve-policy.ts.
app.get('/api/admin/auto-approve', (c) => {
  return c.json({ records: listAutoApproveRecords() });
});

app.post('/api/admin/auto-approve/:sender', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : null;
  const sender = c.req.param('sender');
  const record = setAutoApproveOverride(sender, enabled);
  return c.json({ sender, record });
});

// Headless Gmail/Calendar re-authorization — for a Testing-mode Google OAuth
// client, the refresh token expires every few days, and the app has no
// display to run the normal browser-based flow on. WIREASSIST_OAUTH_REDIRECT_URI
// is a URL this same server can receive (e.g. a Tailscale-HTTPS hostname),
// registered as an Authorized redirect URI in Google Cloud Console — a human
// taps the generated link from anywhere on the tailnet (a phone works fine),
// consents, and Google redirects the code straight back here.
app.get('/api/admin/gmail/reauth-url', (c) => {
  const redirectUri = process.env.WIREASSIST_OAUTH_REDIRECT_URI;
  if (!redirectUri) {
    return c.json({ error: 'WIREASSIST_OAUTH_REDIRECT_URI is not configured.' }, 500);
  }
  try {
    return c.json({ url: new GmailClient().generateWebAuthUrl(redirectUri) });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

app.get('/api/admin/gmail/oauth-callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const redirectUri = process.env.WIREASSIST_OAUTH_REDIRECT_URI;

  if (error) return c.html(`<h1>❌ Authorization failed: ${error}</h1>`, 400);
  if (!code) return c.html('<h1>❌ No authorization code received.</h1>', 400);
  if (!redirectUri)
    return c.html('<h1>❌ WIREASSIST_OAUTH_REDIRECT_URI is not configured.</h1>', 500);

  try {
    logger.info(`[gmail-reauth] code received, exchanging (redirectUri=${redirectUri})`);
    await new GmailClient().completeWebAuth(code, redirectUri);
    logger.info('[gmail-reauth] token exchange + save succeeded');
    // Rebuild Gmail/Calendar/Sheets clients and re-register their MCP tools
    // against the fresh token — same call bootstrap() makes at startup.
    await setupAdminMCP(mcp);
    logger.info('[gmail-reauth] setupAdminMCP re-registered tools; gmailReady = true');
    gmailReady = true;
    gmailReauthWarnedAt = null;
    return c.html('<h1>✅ WireAssist Gmail/Calendar re-authorized. You can close this tab.</h1>');
  } catch (err) {
    logger.error('[gmail-reauth] failed:', err);
    return c.html(`<h1>❌ ${err instanceof Error ? err.message : String(err)}</h1>`, 500);
  }
});

app.post('/api/tasks/ops-workflow', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { workflow, brief, objectiveId } = await c.req.json();
  if (!workflow || typeof workflow !== 'string') return c.json({ error: 'workflow required' }, 400);
  if (!brief || typeof brief !== 'string') return c.json({ error: 'brief required' }, 400);
  const task = OpsTasks.createWorkflowRunTask({
    workflow,
    brief,
    objectiveId: typeof objectiveId === 'string' ? objectiveId : undefined,
  });
  queueOpsTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/ops-freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { prompt, objectiveId } = await c.req.json();
  if (!prompt || typeof prompt !== 'string') return c.json({ error: 'prompt required' }, 400);
  const task = OpsTasks.createOpsFreeformTask({
    prompt,
    objectiveId: typeof objectiveId === 'string' ? objectiveId : undefined,
  });
  queueOpsTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/ops-trust-nudges', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const task = OpsTasks.createTrustGraduationNudgesTask();
  queueOpsTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// ── GTM TASKS ─────────────────────────────────────────────────────────────
const GTM_FIELDS = [
  'name',
  'cat',
  'problem',
  'benefit',
  'diff',
  'buyer',
  'segment',
  'comp',
  'channels',
  'pain',
  'price',
  'model',
  'free',
  'goal',
  'current',
  'budget',
] as const;

function normalizeGtmProduct(body: unknown): GtmProductInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const src = body as Record<string, unknown>;
  if (typeof src.name !== 'string' || src.name.trim().length === 0) return null;

  const product = {} as GtmProductInput;
  for (const field of GTM_FIELDS) {
    const value = src[field];
    product[field] = typeof value === 'string' ? value : '';
  }
  return product;
}

app.post('/api/tasks/gtm/strategy', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const product = normalizeGtmProduct(body);
  if (!product) return c.json({ error: 'product name required' }, 400);
  const offerContentDraft = isValidPlatform(body.contentDraftPlatform)
    ? {
        platform: body.contentDraftPlatform,
        tone: typeof body.contentDraftTone === 'string' ? body.contentDraftTone : undefined,
      }
    : undefined;
  const calendarPlatforms = Array.isArray(body.contentCalendarPlatforms)
    ? body.contentCalendarPlatforms.filter(isValidPlatform)
    : [];
  const offerContentCalendar =
    calendarPlatforms.length > 0 ? { platforms: calendarPlatforms } : undefined;
  const task = GtmTasks.generateStrategy(
    product,
    offerContentDraft,
    offerContentCalendar,
    typeof body.objectiveId === 'string' ? body.objectiveId : undefined
  );
  queueGtmTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/gtm/psych', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const body = await c.req.json().catch(() => ({}));
  const product = normalizeGtmProduct(body);
  if (!product) return c.json({ error: 'product name required' }, 400);
  const task = GtmTasks.generatePsychTactics(
    product,
    typeof body.objectiveId === 'string' ? body.objectiveId : undefined
  );
  queueGtmTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/gtm-freeform', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { prompt, objectiveId } = await c.req.json();
  if (!prompt || typeof prompt !== 'string') return c.json({ error: 'prompt required' }, 400);
  const task = GtmTasks.freeform(
    prompt,
    undefined,
    typeof objectiveId === 'string' ? objectiveId : undefined
  );
  queueGtmTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

app.post('/api/tasks/github-freeform', async (c) => {
  if (!githubReady) return c.json({ error: 'GitHub agent not configured' }, 503);
  if (!anthropicConfigured()) return c.json(anthropicRequiredResponse(), 503);
  const { prompt, objectiveId } = await c.req.json();
  if (!prompt || typeof prompt !== 'string') return c.json({ error: 'prompt required' }, 400);
  const task = GitHubTasks.freeform(
    prompt,
    undefined,
    typeof objectiveId === 'string' ? objectiveId : undefined
  );
  queueGithubTask(task);
  return c.json({ taskId: task.id, status: 'queued' });
});

// No anthropicConfigured() gate — the summary is a fixed template, not
// think()-phrased (see stale-prs.ts), so it works even before an Anthropic
// key is configured, matching objective-health-check's precedent.
app.post('/api/tasks/stale-prs', async (c) => {
  if (!githubAgent || !githubReady) {
    return c.json({ error: 'GitHub agent not connected' }, 503);
  }
  const body = await c.req.json().catch(() => ({}));
  const daysStale = Number.isFinite(body.daysStale) && body.daysStale >= 0 ? body.daysStale : 5;
  const [owner, repo] = (process.env.WIREASSIST_REPO ?? 'tbmobb813/WireAssist').split('/');
  try {
    const raw = await githubAgent.callReadOnlyTool('list_pull_requests', {
      owner,
      repo,
      state: 'open',
      perPage: 100,
    });
    const task = GitHubTasks.stalePrs(parsePrListResult(raw), daysStale);
    queueGithubTask(task);
    return c.json({ taskId: task.id, status: 'queued' });
  } catch (err) {
    logger.error('Stale PR check failed', err instanceof Error ? err.message : err);
    return c.json({ error: 'Failed to list pull requests' }, 502);
  }
});

// Best-effort pre-fill for the GTM wizard: name always; category/problem/benefit/
// differentiator only if the focused (or first active) project has a repoPath
// in its metadata pointing at a repo with a README.md/STATUS.md.
app.get('/api/tasks/gtm/prefill', async (c) => {
  if (!agentReady) return c.json({ prefill: null });

  const today = await portfolioStore.today();
  const targetId = today.focus?.productProjectId ?? today.active[0]?.id;
  if (!targetId) return c.json({ prefill: null });

  const project = await portfolioStore.getProject(targetId);
  if (!project) return c.json({ prefill: null });

  if (!anthropicConfigured()) {
    return c.json({ prefill: { name: project.name, docFound: false } });
  }

  const repoPath = (project.metadata as { repoPath?: string } | null)?.repoPath;
  try {
    const prefill = await prefillFromRepoDoc(project.name, repoPath);
    return c.json({ prefill });
  } catch {
    return c.json({ prefill: { name: project.name, docFound: false } });
  }
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

app.get('/api/content/campaigns', (c) => {
  if (!agentReady) return c.json([]);
  return c.json(trendpostStorage.listCampaigns());
});

app.post('/api/content/campaigns', async (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return c.json({ error: 'name required' }, 400);
  }
  return c.json(trendpostStorage.createCampaign({ name: body.name.trim(), source: 'manual' }), 201);
});

// Direct bookkeeping, not an agent task or approval: the user is confirming
// something they already did outside the system (posted it manually), not
// asking the agent to take an action.
app.post('/api/content/posts/:id/publish', (c) => {
  if (!agentReady) return c.json({ error: 'Agent not ready' }, 503);
  const id = c.req.param('id');
  const existing = trendpostStorage.getPost(id);
  if (!existing) return c.json({ error: 'post not found' }, 404);
  trendpostStorage.updatePostStatus(id, 'published');
  return c.json(trendpostStorage.getPost(id));
});

// ── MEMORY ────────────────────────────────────────────────────────────────
app.get('/api/memory', async (c) => {
  const query = (c.req.query('q') ?? '').trim();
  const agentRole = c.req.query('agentRole') as AgentRole | undefined;
  const filters = agentRole ? { agentRole } : undefined;
  if (!query) return c.json(memory.listRecent(50, filters));
  return c.json(await memory.searchAsync(query, filters));
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

const server = serve({ fetch: app.fetch, port: API_PORT, hostname: '0.0.0.0' }, (info) => {
  logger.info(`🚀 API server running at http://localhost:${info.port}`);
  bootstrap().catch((err) => {
    logger.error('❌ Agent bootstrap failed:', err);
    process.exit(1);
  });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      `❌ Port ${API_PORT} is already in use.\n` +
        `   Stop the other process: fuser -k ${API_PORT}/tcp\n` +
        `   Or use another port: API_PORT=3003 pnpm dev:api`
    );
    process.exit(1);
  }
  throw err;
});
