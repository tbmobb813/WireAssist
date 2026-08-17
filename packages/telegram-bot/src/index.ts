/**
 * WireAssist Telegram bot — zero-dependency long-polling client.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN   (required) from @BotFather
 *   TELEGRAM_CHAT_ID     (required) your chat id — all other chats are ignored
 *   WIREASSIST_API_URL   command-center API (default http://localhost:3002)
 *
 * Commands:
 *   /status              agent statuses
 *   /budget              month-to-date spend vs cap
 *   /approvals           list pending approval requests
 *   /approve <id>        approve a pending request
 *   /reject <id>         reject a pending request
 *   /workflows           list NixOps workflows
 *   /run <wf> <brief>    queue a NixOps workflow run
 *   /ask <prompt>        ask anything — routed to the right agent automatically
 *                        (admin, content, research, or ops; GTM requests get
 *                        pointed at the /gtm wizard instead of a direct answer)
 *   /reauth              get a tap-to-reauthorize link for Gmail/Calendar
 *                        (Testing-mode Google OAuth refresh tokens expire
 *                        every few days — same link also gets pushed here
 *                        automatically before that happens)
 *
 * Also subscribes to the command-center SSE feed and pushes back results from
 * whichever agent handled the request — admin, content, research, or ops —
 * plus waiting_approval / task_failed regardless of origin.
 *
 * Independently, polls the API's /health endpoint and alerts on down/recovery
 * transitions — SSE reconnects silently forever on its own, so a dead API
 * process would otherwise go unnoticed until the next on-demand command.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API_URL = process.env.WIREASSIST_API_URL ?? 'http://localhost:3002';

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set.');
  process.exit(1);
}

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function send(text: string): Promise<void> {
  await fetch(`${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
  }).catch((err) => console.error('sendMessage failed:', err));
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `API ${res.status} on ${path}`);
  }
  return body;
}

// ── Command handlers ────────────────────────────────────────────────────────

async function handleCommand(text: string): Promise<string> {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const args = rest.join(' ');

  switch (cmd) {
    case '/start':
    case '/help':
      return [
        '*WireAssist bot*',
        '/status — agent statuses',
        '/budget — spend vs monthly cap',
        '/approvals — pending approvals',
        '/approve <id> · /reject <id>',
        '/workflows — NixOps workflows',
        '/run <workflow> <brief>',
        '/ask <prompt> — routed to the right agent automatically',
        '/reauth — get a Gmail/Calendar re-authorization link',
      ].join('\n');

    case '/status': {
      const s = (await api('/api/agent/status')) as Record<
        string,
        { name: string; status: string }
      >;
      return Object.values(s)
        .map(
          (a) =>
            `${a.status === 'idle' ? '🟢' : a.status === 'error' ? '🔴' : '🟡'} ${a.name}: ${a.status}`
        )
        .join('\n');
    }

    case '/budget': {
      const b = (await api('/api/budget')) as {
        budget: number;
        spent: number;
        remaining: number;
        percent: number;
        byModel: Record<string, { cost: number; calls: number }>;
      };
      const lines = [
        `*Budget:* $${b.spent.toFixed(2)} / $${b.budget.toFixed(2)} (${b.percent.toFixed(1)}%)`,
        `Remaining: $${b.remaining.toFixed(2)}`,
      ];
      for (const [model, m] of Object.entries(b.byModel)) {
        lines.push(`· ${model}: $${m.cost.toFixed(3)} (${m.calls} calls)`);
      }
      return lines.join('\n');
    }

    case '/approvals': {
      const pending = (await api('/api/approvals')) as Array<{
        id: string;
        agentRole: string;
        action: string;
      }>;
      if (pending.length === 0) return 'No pending approvals.';
      return pending
        .map(
          (p) =>
            `⏳ \`${p.id}\`\n${p.agentRole}: ${p.action}\n/approve\\_${p.id} · /reject\\_${p.id}`
        )
        .join('\n\n');
    }

    case '/approve':
    case '/reject': {
      if (!args) return `Usage: ${cmd} <approval-id>`;
      const verb = cmd === '/approve' ? 'approve' : 'reject';
      await api(`/api/approvals/${args}/${verb}`, { method: 'POST' });
      return `${verb === 'approve' ? '✅ Approved' : '🚫 Rejected'}: ${args}`;
    }

    case '/workflows': {
      const w = (await api('/api/ops/workflows')) as { workflows: string[] };
      return `*NixOps workflows:*\n${w.workflows.map((x) => `· ${x}`).join('\n')}`;
    }

    case '/run': {
      const [workflow, ...briefParts] = rest;
      const brief = briefParts.join(' ');
      if (!workflow || !brief) return 'Usage: /run <workflow> <brief>';
      const r = (await api('/api/tasks/ops-workflow', {
        method: 'POST',
        body: JSON.stringify({ workflow, brief }),
      })) as { taskId: string };
      return `🚀 Queued *${workflow}*\nTask: \`${r.taskId}\`\nYou'll get a ping when it needs approval.`;
    }

    case '/reauth': {
      const r = (await api('/api/admin/gmail/reauth-url')) as { url: string };
      return `🔐 Tap to re-authorize Gmail/Calendar:\n${r.url}\n\n(Must be connected to Tailscale.)`;
    }

    case '/ask': {
      if (!args) return 'Usage: /ask <prompt>';
      // Same smart router the Command Center chat page uses — one message in,
      // dispatched to whichever agent (admin/content/research/ops) fits.
      const r = (await api('/api/tasks/freeform', {
        method: 'POST',
        body: JSON.stringify({ instruction: args }),
      })) as { taskId?: string; redirect?: string; message?: string };
      if (r.redirect) {
        return `${r.message ?? ''}\n\nOpen: ${r.redirect}`;
      }
      return `🧠 Task queued (\`${r.taskId}\`) — answer will arrive here.`;
    }

    default:
      // Support the /approve_<id> deep-link form emitted by /approvals
      if (cmd.startsWith('/approve_')) return handleCommand(`/approve ${cmd.slice(9)}`);
      if (cmd.startsWith('/reject_')) return handleCommand(`/reject ${cmd.slice(8)}`);
      return 'Unknown command. Try /help';
  }
}

// ── Long polling ────────────────────────────────────────────────────────────

let offset = 0;

async function pollLoop(): Promise<never> {
  for (;;) {
    try {
      const res = await fetch(`${TG}/getUpdates?timeout=50&offset=${offset}`);
      const data = (await res.json()) as {
        ok: boolean;
        result: Array<{ update_id: number; message?: { chat: { id: number }; text?: string } }>;
      };
      for (const update of data.result ?? []) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text) continue;
        if (String(msg.chat.id) !== CHAT_ID) continue; // allowlist: owner only
        try {
          await send(await handleCommand(msg.text));
        } catch (err) {
          await send(`⚠️ ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      console.error('poll error:', err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// ── SSE push notifications ──────────────────────────────────────────────────

async function sseLoop(): Promise<never> {
  for (;;) {
    try {
      const res = await fetch(`${API_URL}/api/events`);
      if (!res.ok || !res.body) throw new Error(`SSE connect failed: ${res.status}`);
      console.log('SSE connected');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const line = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            await notify(
              JSON.parse(line.slice(6)) as { event: string; payload: Record<string, unknown> }
            );
          } catch {
            /* ignore malformed events */
          }
        }
      }
    } catch (err) {
      console.error('SSE error:', err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function notify(e: { event: string; payload: Record<string, unknown> }): Promise<void> {
  const p = e.payload;
  switch (e.event) {
    case 'waiting_approval':
      await send(
        `⏳ *Approval needed*\nAgent: ${p.agentName ?? p.agentRole}\nAction: ${p.action}\n\nUse /approvals to review.`
      );
      break;
    case 'auto_approved': {
      const action = p.action as { label?: string } | undefined;
      await send(
        `🤖 *Auto-approved* (${p.agentRole}): ${action?.label ?? 'an action'} — already trusted, no approval needed.`
      );
      break;
    }
    case 'ops_blocked':
      await send(`🛑 *NixOps blocked*\n${String(p.diagnosis ?? '').slice(0, 800)}`);
      break;
    case 'ops_run_complete':
      await send(`✅ *Workflow ${p.workflow}* finished — ${p.approved ? 'approved' : 'rejected'}.`);
      break;
    case 'ops_freeform_response':
      await send(`🧠 ${String(p.response ?? '').slice(0, 3500)}`);
      break;
    case 'freeform_response':
      await send(`🧠 ${String(p.response ?? '').slice(0, 3500)}`);
      break;
    case 'content_generated':
      await send(`✍️ *Generated ${p.platform} post:*\n\n${String(p.content ?? '').slice(0, 3500)}`);
      break;
    case 'content_plan_generated':
      await send(
        `✍️ Content plan generated: ${p.totalGenerated} posts. Check the Content tab for details.`
      );
      break;
    case 'content_approved':
      await send(`✅ *Approved ${p.platform} post:*\n\n${String(p.content ?? '').slice(0, 3500)}`);
      break;
    case 'post_scheduled': {
      const post = p.post as { platform?: string; scheduledAt?: string } | undefined;
      const when = post?.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'soon';
      await send(`📅 *Scheduled ${post?.platform ?? 'a'} post* for ${when}.`);
      break;
    }
    case 'research_complete': {
      const sources =
        Array.isArray(p.sources) && p.sources.length > 0
          ? `\n\nSources:\n${(p.sources as string[]).join('\n')}`
          : '';
      await send(`🔍 ${String(p.summary ?? '').slice(0, 3000)}${sources}`);
      break;
    }
    case 'gtm_generated': {
      const gtm = p.gtm as { positioning?: { headline?: string } } | undefined;
      await send(
        `🚀 *GTM strategy generated:* ${gtm?.positioning?.headline ?? 'ready to review'}. Check the GTM tab for the full plan.`
      );
      break;
    }
    case 'gtm_psych_generated': {
      const psych = Array.isArray(p.psych) ? p.psych : [];
      await send(
        `🧠 *GTM psych tactics generated:* ${psych.length} principle(s) ready. Check the GTM tab for details.`
      );
      break;
    }
    case 'gmail_reauth_needed': {
      const days = typeof p.daysRemaining === 'number' ? p.daysRemaining : null;
      const when = p.expired
        ? 'has *expired*'
        : days !== null
          ? `expires in ~${days.toFixed(1)} day(s)`
          : 'is expiring soon';
      await send(`🔐 Gmail/Calendar authorization ${when}. Tap to fix:\n${String(p.url ?? '')}`);
      break;
    }
    case 'task_failed':
      await send(`🔴 Task failed (${p.agentRole}): ${String(p.error ?? '').slice(0, 500)}`);
      break;
    case 'daily_briefing_complete':
      await send(`☀️ ${String(p.summary ?? '').slice(0, 3500)}`);
      break;
    case 'follow_up_nudges_complete': {
      const staleThreads = Array.isArray(p.staleThreads) ? p.staleThreads : [];
      if (staleThreads.length === 0) break;
      await send(`📨 ${staleThreads.length} follow-up nudge(s) drafted. Check /approvals.`);
      break;
    }
    case 'proactive_insights_complete': {
      const findings = Array.isArray(p.findings) ? p.findings : [];
      if (findings.length === 0) break;
      await send(`💡 ${String(p.summary ?? '').slice(0, 3000)}`);
      break;
    }
    case 'trust_graduation_nudges_complete': {
      const candidates = Array.isArray(p.candidates) ? p.candidates : [];
      if (candidates.length === 0) break;
      await send(`🎓 ${String(p.summary ?? '').slice(0, 3000)}`);
      break;
    }
    case 'budget_warning_complete': {
      if (!p.warranted) break;
      await send(`💸 ${String(p.summary ?? '').slice(0, 3000)}`);
      break;
    }
    case 'stale_approvals_complete': {
      const stale = Array.isArray(p.stale) ? p.stale : [];
      if (stale.length === 0) break;
      await send(`⏰ ${String(p.summary ?? '').slice(0, 3000)}\n\nUse /approvals to review.`);
      break;
    }
    case 'publish_due_posts_complete': {
      const published = Array.isArray(p.published) ? p.published : [];
      const failed = Array.isArray(p.failed) ? p.failed : [];
      if (published.length === 0 && failed.length === 0) break;
      await send(`📤 ${String(p.summary ?? '').slice(0, 3000)}`);
      break;
    }
  }
}

// ── API health monitoring ───────────────────────────────────────────────────

const HEALTH_CHECK_INTERVAL_MS = 60_000;
// Require 3 consecutive failures (~3 min) before alerting, so a single blip
// (deploy restart, brief network hiccup) doesn't page unnecessarily.
const HEALTH_FAILURE_THRESHOLD = 3;

async function healthLoop(): Promise<never> {
  let consecutiveFailures = 0;
  let isDown = false;

  for (;;) {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      consecutiveFailures = 0;
      if (isDown) {
        isDown = false;
        await send('✅ WireAssist API is back up.');
      }
    } catch (err) {
      consecutiveFailures += 1;
      if (!isDown && consecutiveFailures >= HEALTH_FAILURE_THRESHOLD) {
        isDown = true;
        const reason = err instanceof Error ? err.message : String(err);
        await send(
          `🔴 WireAssist API unreachable at ${API_URL} (${consecutiveFailures} checks failed). Last error: ${reason}`
        );
      }
    }
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS));
  }
}

console.log(`WireAssist Telegram bot starting (API: ${API_URL})`);
void pollLoop();
void sseLoop();
void healthLoop();
