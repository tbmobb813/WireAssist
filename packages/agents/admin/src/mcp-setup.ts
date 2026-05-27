import { MCPClient } from '@synqworks/core';
import { GmailClient } from './gmail-client';
import { CalendarClient } from './calendar-client';

export async function setupAdminMCP(mcp: MCPClient): Promise<void> {
  const gmail = new GmailClient();
  await gmail.authenticate();

  let cal = new CalendarClient(); // No separate auth — reuses Gmail token

  // Validate calendar access up-front so demo doesn't fail mid-task with opaque 403 errors.
  try {
    await cal.listEvents({
      timeMin: new Date().toISOString(),
      maxResults: 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('insufficient authentication scopes')) {
      throw error;
    }

    console.log('\n⚠️  Calendar scope missing from token. Starting re-authorization...');
    await gmail.authenticate({ forceReauth: true });
    cal = new CalendarClient();
  }

  // ── GMAIL (unchanged) ──────────────────────────────────────────
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

  // ── CALENDAR (now real) ────────────────────────────────────────
  mcp.register('calendar_list_events', async (params) => {
    return cal.listEvents({
      timeMin: params.timeMin as string,
      timeMax: params.timeMax as string,
      maxResults: params.maxResults as number,
    });
  });

  mcp.register('calendar_create_event', async (params) => {
    const start =
      typeof params.start === 'string'
        ? params.start
        : (params.start as { dateTime?: string } | undefined)?.dateTime;
    const end =
      typeof params.end === 'string'
        ? params.end
        : (params.end as { dateTime?: string } | undefined)?.dateTime;
    const attendees = (params.attendees as (string | { email?: string })[] | undefined)
      ?.map((attendee) => (typeof attendee === 'string' ? attendee : attendee.email))
      .filter((email): email is string => typeof email === 'string' && email.length > 0);
    if (!start || !end) {
      throw new Error('calendar_create_event requires start and end dateTime values.');
    }

    return cal.createEvent({
      summary: params.summary as string,
      start,
      end,
      attendees,
      description: params.description as string | undefined,
      location: params.location as string | undefined,
    });
  });

  mcp.register('calendar_update_event', async (params) => {
    await cal.updateEvent({
      eventId: params.eventId as string,
      summary: params.summary as string | undefined,
      start: params.start as string | undefined,
      end: params.end as string | undefined,
    });
    return { status: 'updated' };
  });

  mcp.register('calendar_delete_event', async (params) => {
    await cal.deleteEvent({ eventId: params.eventId as string });
    return { status: 'deleted' };
  });

  mcp.register('calendar_find_availability', async (params) => {
    return cal.findAvailability({
      timeMin: params.timeMin as string,
      timeMax: params.timeMax as string,
      durationMinutes: params.durationMinutes as number,
    });
  });
}
