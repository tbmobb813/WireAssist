import { MCPClient } from '@synqworks/core';
import { GmailClient } from './gmail-client';

export async function setupAdminMCP(mcp: MCPClient): Promise<void> {
  const gmail = new GmailClient();
  await gmail.authenticate(); // runs OAuth flow on first run, uses token after

  // ── GMAIL ──────────────────────────────────────────────────────

  mcp.register('gmail_list_threads', async (params) => {
    return gmail.listThreads({
      maxResults: params.maxResults as number,
      labelIds: params.labelIds as string[],
      q: params.q as string,
    });
  });

  mcp.register('gmail_get_thread', async (params) => {
    return gmail.getThread(params.threadId as string);
  });

  mcp.register('gmail_create_draft', async (params) => {
    return gmail.createDraft({
      threadId: params.threadId as string,
      to: params.to as string,
      subject: params.subject as string,
      body: params.body as string,
    });
  });

  mcp.register('gmail_send', async (params) => {
    return gmail.sendEmail({
      to: params.to as string,
      subject: params.subject as string,
      body: params.body as string,
      threadId: params.threadId as string | undefined,
    });
  });

  mcp.register('gmail_label_thread', async (params) => {
    await gmail.labelThread({
      threadId: params.threadId as string,
      labelName: params.labelName as string,
    });
    return { status: 'labeled' };
  });

  // Calendar stays mocked for now — Phase 2C
  mcp.register('calendar_list_events', async () => []);
  mcp.register('calendar_create_event', async (p) => {
    console.log('[MCP] calendar_create_event (mock):', p);
    return { status: 'created' };
  });
  mcp.register('calendar_update_event', async (p) => ({ status: 'updated' }));
  mcp.register('calendar_delete_event', async (p) => ({ status: 'deleted' }));
}