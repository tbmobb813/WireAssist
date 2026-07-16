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
 *   /ask <prompt>        freeform NixOps question
 *
 * Also subscribes to the command-center SSE feed and pushes
 * waiting_approval / task_complete / task_failed / ops_blocked events.
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
        '/ask <prompt>',
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

    case '/ask': {
      if (!args) return 'Usage: /ask <prompt>';
      const r = (await api('/api/tasks/ops-freeform', {
        method: 'POST',
        body: JSON.stringify({ prompt: args }),
      })) as { taskId: string };
      return `🧠 Asked NixOps (task \`${r.taskId}\`) — answer will arrive here.`;
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
    case 'ops_blocked':
      await send(`🛑 *NixOps blocked*\n${String(p.diagnosis ?? '').slice(0, 800)}`);
      break;
    case 'ops_run_complete':
      await send(`✅ *Workflow ${p.workflow}* finished — ${p.approved ? 'approved' : 'rejected'}.`);
      break;
    case 'ops_freeform_response':
      await send(`🧠 ${String(p.response ?? '').slice(0, 3500)}`);
      break;
    case 'task_failed':
      await send(`🔴 Task failed (${p.agentRole}): ${String(p.error ?? '').slice(0, 500)}`);
      break;
  }
}

console.log(`WireAssist Telegram bot starting (API: ${API_URL})`);
void pollLoop();
void sseLoop();
