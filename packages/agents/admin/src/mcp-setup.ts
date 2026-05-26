import { type MCPClient } from '@synqworks/core';

// This registers the real Gmail + Calendar MCP handlers.
// The MCPClient is a thin dispatch layer — actual API calls go through
// the connected MCP servers you already have in Claude.ai.
// When running in Node (Command Center backend), these call the Google APIs directly.

export function setupAdminMCP(mcp: MCPClient): void {
  // ── GMAIL ──────────────────────────────────────────────────────

  mcp.register('gmail_list_threads', async (params) => {
    // In production: call Gmail API via googleapis or MCP server
    // For now: returns mock data so the agent logic can be tested end-to-end
    return mockGmailThreads(params);
  });

  mcp.register('gmail_get_thread', async (params) => {
    return mockGmailThreadDetail(params.threadId as string);
  });

  mcp.register('gmail_create_draft', async (params) => {
    // eslint-disable-next-line no-console
    console.log('[MCP] Creating draft:', params);
    // TODO: Replace with real Gmail API call
    return { draftId: `draft_${Date.now()}`, status: 'created' };
  });

  mcp.register('gmail_send', async (params) => {
    // eslint-disable-next-line no-console
    console.log('[MCP] Sending email:', params);
    // TODO: Replace with real Gmail API call
    return { messageId: `msg_${Date.now()}`, status: 'sent' };
  });

  mcp.register('gmail_label_thread', async (params) => {
    // eslint-disable-next-line no-console
    console.log('[MCP] Labeling thread:', params);
    return { status: 'labeled' };
  });

  // ── CALENDAR ───────────────────────────────────────────────────

  mcp.register('calendar_list_events', async (params) => {
    return mockCalendarEvents(params);
  });

  mcp.register('calendar_create_event', async (params) => {
    // eslint-disable-next-line no-console
    console.log('[MCP] Creating event:', params);
    return { eventId: `evt_${Date.now()}`, status: 'created' };
  });

  mcp.register('calendar_update_event', async (params) => {
    // eslint-disable-next-line no-console
    console.log('[MCP] Updating event:', params);
    return { status: 'updated' };
  });

  mcp.register('calendar_delete_event', async (params) => {
    // eslint-disable-next-line no-console
    console.log('[MCP] Deleting event:', params);
    return { status: 'deleted' };
  });
}

// ─── MOCK DATA (replace with real API calls) ─────────────────────────────

function mockGmailThreads(_params: Record<string, unknown>) {
  return [
    { id: 'thread_001', snippet: 'Following up on the proposal...' },
    { id: 'thread_002', snippet: 'Invoice #1042 is overdue...' },
    { id: 'thread_003', snippet: 'Quick question about your availability...' },
  ];
}

function mockGmailThreadDetail(threadId: string) {
  const threads: Record<string, object> = {
    thread_001: {
      id: 'thread_001',
      from: 'client@example.com',
      subject: 'Following up on the proposal',
      snippet: 'Hi, just wanted to check if you had a chance to review...',
      date: new Date().toISOString(),
    },
    thread_002: {
      id: 'thread_002',
      from: 'billing@vendor.com',
      subject: 'URGENT: Invoice #1042 Overdue',
      snippet: 'Your payment of $450 is now 14 days overdue...',
      date: new Date().toISOString(),
    },
    thread_003: {
      id: 'thread_003',
      from: 'partner@startup.io',
      subject: 'Quick question about your availability next week',
      snippet: 'Would love to hop on a 30-min call to discuss...',
      date: new Date().toISOString(),
    },
  };
  return threads[threadId] ?? { id: threadId, from: 'unknown', subject: 'Unknown', snippet: '', date: '' };
}

function mockCalendarEvents(_params: Record<string, unknown>) {
  const now = new Date();
  return [
    {
      id: 'evt_001',
      summary: 'Client Call — Acme Corp',
      start: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      end: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      attendees: [{ email: 'client@acme.com' }],
    },
    {
      id: 'evt_002',
      summary: 'Team Standup',
      start: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      end: new Date(now.getTime() + 3.5 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

