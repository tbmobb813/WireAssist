import { randomUUID } from 'crypto';
import type { Skill } from '@wireassist/core';
import { logger } from '@wireassist/core/logger';
import {
  extractJson,
  type EmailTriageResult,
  type GmailThread,
  type GmailThreadDetail,
  type ProposedAction,
  type TriageCategories,
} from '../types';
import { proposeBatchOrAutoApprove } from './propose-or-auto-approve';

export const emailTriageSkill: Skill<{ maxEmails?: number }, EmailTriageResult> = {
  name: 'email_triage',
  role: 'admin',
  description: 'Fetch unread inbox threads, triage them, and propose actions.',
  requiresApproval: true,

  async execute({ agent, task, input }) {
    // 1. Fetch inbox threads
    const threads = (await agent.useTool('gmail_list_threads', {
      maxResults: input.maxEmails ?? 20,
      labelIds: ['INBOX'],
      q: 'is:unread',
    })) as GmailThread[];

    if (!threads || threads.length === 0) {
      const result: EmailTriageResult = {
        taskId: task.id,
        totalEmails: 0,
        categories: { urgent: [], replyNeeded: [], fyi: [], ignore: [] },
        proposedActions: [],
        summary: 'Inbox is empty or no unread messages.',
      };
      agent.emit('agent:triage_complete', result);
      return result;
    }

    // 2. Fetch thread details in parallel (cap at 10 to avoid token bloat)
    const threadDetails = await Promise.all(
      threads
        .slice(0, 10)
        .map(
          (t) => agent.useTool('gmail_get_thread', { threadId: t.id }) as Promise<GmailThreadDetail>
        )
    );

    // 3. Load memory context — who we know, past decisions
    const context = await agent.loadContext('email contacts preferences ignore rules');

    // 4. Ask Claude to triage
    const triagePrompt = `
Triage these ${threadDetails.length} email threads.

THREADS:
${threadDetails
  .map(
    (t, i) => `
ThreadId: ${t.id}
[${i + 1}] From: ${t.from}
Subject: ${t.subject}
Snippet: ${t.snippet}
Date: ${t.date}
`
  )
  .join('\n')}

Return a JSON object with this exact structure:
{
  "categories": {
    "urgent": [{ "threadId": string, "from": string, "subject": string, "reason": string }],
    "replyNeeded": [{ "threadId": string, "from": string, "subject": string, "draftReply": string }],
    "fyi": [{ "threadId": string, "from": string, "subject": string }],
    "ignore": [{ "threadId": string, "from": string, "reason": string }]
  },
  "summary": "2-3 sentence overview of inbox state",
  "urgentCount": number,
  "replyNeededCount": number
}

For "urgent", the "reason" must state the specific cost of inaction (what breaks, by when) —
not a generic "this seems important." For "ignore", the "reason" must say why it's safe to
skip, even when it's an obvious newsletter/receipt — Jason should be able to verify the ignore
pile by skimming reasons, not by re-reading every email himself.

Only return valid JSON. No markdown fences.`;

    // Default maxTokens (Admin's config: 4096) genuinely wasn't enough here
    // — a real live failure showed the response truncated mid-string with
    // no closing quote, well before the object closed. Up to 10 detailed
    // threads across 4 categories, each with its own reasoning field, adds
    // up fast. Explicit override rather than raising Admin's global default,
    // since this is the one call in its skill set that scales with inbox
    // volume the way nothing else here does.
    const rawResponse = await agent.think(triagePrompt, context, 8192);

    let triage: TriageCategories;
    try {
      triage = extractJson<TriageCategories>(rawResponse);
    } catch (err) {
      // The error surfaced to the caller/model only ever carried the first
      // 200 chars — nowhere near enough to diagnose a real failure (this
      // was already invisible in server logs entirely, since callers just
      // catch-and-return the message as a tool_result string, never log
      // it). Full response logged here so a real failure is actually
      // debuggable instead of a black box.
      logger.error(
        '[email-triage] extractJson failed:',
        err instanceof Error ? err.message : err,
        '\nFull raw response:\n',
        rawResponse
      );
      throw new Error(
        `Admin Agent returned invalid JSON during triage: ${rawResponse.slice(0, 200)}`
      );
    }

    // 5. Build proposed actions
    const proposedActions: ProposedAction[] = [];
    const validThreadIds = new Set(threadDetails.map((thread) => thread.id));

    // Propose drafts for reply-needed emails
    for (const email of triage.categories.replyNeeded ?? []) {
      if (!validThreadIds.has(email.threadId)) continue;
      proposedActions.push({
        id: randomUUID(),
        type: 'gmail_create_draft',
        label: `Draft reply to: "${email.subject}" from ${email.from}`,
        payload: {
          threadId: email.threadId,
          body: email.draftReply,
        },
      });
    }

    // Propose labeling urgent emails
    for (const email of triage.categories.urgent ?? []) {
      if (!validThreadIds.has(email.threadId)) continue;
      proposedActions.push({
        id: randomUUID(),
        type: 'gmail_label_thread',
        label: `Mark as URGENT: "${email.subject}"`,
        payload: {
          threadId: email.threadId,
          labelName: 'URGENT',
        },
      });
    }

    // Propose ignore-labeling for the ignore category — this is what makes
    // the ignore pile actionable (and auto-approvable, see
    // proposeBatchOrAutoApprove) rather than just reported.
    for (const email of triage.categories.ignore ?? []) {
      if (!validThreadIds.has(email.threadId)) continue;
      proposedActions.push({
        id: randomUUID(),
        type: 'gmail_label_thread',
        label: `Ignore: "${email.reason}"`,
        payload: {
          threadId: email.threadId,
          labelName: 'IGNORED',
          from: email.from,
        },
      });
    }

    const result: EmailTriageResult = {
      taskId: task.id,
      totalEmails: threadDetails.length,
      categories: triage.categories,
      proposedActions,
      summary: triage.summary,
    };

    // 6. Emit the result — Command Center UI picks this up and renders it
    agent.emit('agent:triage_complete', result);

    // 7. Auto-approve-eligible actions (the narrow ignore-labeling carve-out)
    // execute immediately; everything else needing a real human decision is
    // bundled into ONE batch approval instead of one sequential prompt per
    // action — see proposeBatchOrAutoApprove's own comment for why.
    await proposeBatchOrAutoApprove(agent, task, proposedActions);

    return result;
  },
};
