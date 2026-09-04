// Conversation/message persistence for the /chat dashboard page.
// Registered from server.ts: registerConversationRoutes(app, DB_PATH)
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Hono } from 'hono';
import { ConversationStore, MessageStore } from '@wireassist/core';
import { logger } from '@wireassist/core/logger';

const DEFAULT_TITLE = 'New conversation';
const PLACEHOLDER_PROVIDER = 'anthropic';
const PLACEHOLDER_MODEL = 'wireassist-chat';

export function registerConversationRoutes(
  app: Hono,
  dbPath: string
): { conversations: ConversationStore; messages: MessageStore } {
  mkdirSync(dirname(dbPath), { recursive: true });
  const conversations = new ConversationStore(dbPath);
  const messages = new MessageStore(dbPath);

  app.get('/api/conversations', async (c) => {
    const list = await conversations.list({ limit: 100 });
    return c.json({
      conversations: list.map(({ id, title, createdAt, updatedAt }) => ({
        id,
        title,
        createdAt,
        updatedAt,
      })),
    });
  });

  app.post('/api/conversations', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const title =
      typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : DEFAULT_TITLE;
    const id = await conversations.create({
      title,
      provider: PLACEHOLDER_PROVIDER,
      model: PLACEHOLDER_MODEL,
    });
    return c.json({ id, title }, 201);
  });

  app.delete('/api/conversations/:id', async (c) => {
    await conversations.delete(c.req.param('id'));
    return c.json({ ok: true });
  });

  // Full-text search over every conversation's message content — the
  // messages_fts index (messages.ts) has existed since this feature
  // shipped but had no route exposing it; this is the first consumer.
  // Registered before the /:id routes below so a literal path segment
  // "search" is never captured as a conversation id.
  app.get('/api/conversations/search', async (c) => {
    const query = c.req.query('q')?.trim();
    if (!query) return c.json({ results: [] });

    const matches = await messages.search(query);
    const titleCache = new Map<string, string>();
    const results = [];
    for (const m of matches.slice(0, 50)) {
      let title = titleCache.get(m.conversationId);
      if (title === undefined) {
        try {
          title = (await conversations.get(m.conversationId)).title;
        } catch {
          // Conversation was deleted after this message was indexed but
          // before this search ran — skip rather than surface a dangling
          // reference the UI can't navigate to.
          continue;
        }
        titleCache.set(m.conversationId, title);
      }
      results.push({
        messageId: m.id,
        conversationId: m.conversationId,
        conversationTitle: title,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      });
    }
    return c.json({ results });
  });

  app.get('/api/conversations/:id/messages', async (c) => {
    const id = c.req.param('id');
    try {
      await conversations.get(id); // throws if missing -> 404
    } catch {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    const list = await messages.getByConversation(id);
    return c.json({
      messages: list.map(({ id, role, content, timestamp }) => ({ id, role, content, timestamp })),
    });
  });

  app.post('/api/conversations/:id/messages', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    if (
      typeof body?.content !== 'string' ||
      !body.content.trim() ||
      (body.role !== 'user' && body.role !== 'assistant')
    ) {
      return c.json({ error: "Required: role ('user'|'assistant'), content (string)" }, 400);
    }
    let convo;
    try {
      convo = await conversations.get(id);
    } catch {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    const timestamp = Date.now();
    const messageId = await messages.create({
      conversationId: id,
      role: body.role,
      content: body.content,
      timestamp,
    });

    // Auto-title from the first user message — avoids a second client round-trip.
    // Best-effort: the message above is already durably saved by this point,
    // so a title-update failure must never turn into a 500 for the whole
    // request — worst case the conversation just keeps its default title.
    if (convo.title === DEFAULT_TITLE && body.role === 'user') {
      try {
        await conversations.update(id, { title: body.content.trim().slice(0, 50) });
      } catch (err) {
        logger.warn(`Failed to auto-title conversation ${id}`, err);
      }
    }

    return c.json({ id: messageId, timestamp }, 201);
  });

  return { conversations, messages };
}
