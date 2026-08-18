import { MCPClient } from '@wireassist/core';
import { logger } from '@wireassist/core/logger';
import { GmailClient } from './gmail-client';
import { CalendarClient } from './calendar-client';
import { SheetsClient } from './sheets-client';

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

    logger.warn('\n⚠️  Calendar scope missing from token. Starting re-authorization...');
    await gmail.authenticate({ forceReauth: true });
    cal = new CalendarClient();
  }

  // Sheets scope is granted by the same token as Gmail/Calendar — the
  // hasRequiredScopes() check inside gmail.authenticate() above already
  // forced re-authorization if it was missing, so no separate probe needed.
  const sheets = new SheetsClient();

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

  mcp.register('gmail_unlabel_thread', async (params) => {
    await gmail.unlabelThread({
      threadId: params.threadId as string,
      labelName: params.labelName as string,
    });
    return { status: 'unlabeled' };
  });

  mcp.register('gmail_get_profile', async () => {
    return gmail.getProfile();
  });

  mcp.register('gmail_thread_last_message', async (params) => {
    return gmail.getLastMessageInfo(params.threadId as string);
  });

  mcp.register('gmail_archive_thread', async (params) => {
    await gmail.archiveThread(params.threadId as string);
    return { status: 'archived' };
  });

  mcp.register('gmail_trash_thread', async (params) => {
    await gmail.trashThread(params.threadId as string);
    return { status: 'trashed' };
  });

  mcp.register('gmail_mark_spam', async (params) => {
    await gmail.markSpam(params.threadId as string);
    return { status: 'marked_spam' };
  });

  mcp.register('gmail_list_labels', async () => {
    return gmail.listLabels();
  });

  // Named alias of gmail_list_threads — same handler, distinct tool name so
  // the model reliably picks "search my email" over the more generic list.
  mcp.register('gmail_search', async (params) => {
    return gmail.listThreads({
      maxResults: params.maxResults as number,
      q: params.q as string,
    });
  });

  // ── CALENDAR (now real) ────────────────────────────────────────
  mcp.register('calendar_list_events', async (params) => {
    return cal.listEvents({
      timeMin: params.timeMin as string,
      timeMax: params.timeMax as string,
      maxResults: params.maxResults as number,
      calendarId: params.calendarId as string | undefined,
    });
  });

  mcp.register('calendar_list_calendars', async () => {
    return cal.listCalendars();
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
      recurrence: params.recurrence as string[] | undefined,
      calendarId: params.calendarId as string | undefined,
    });
  });

  mcp.register('calendar_update_event', async (params) => {
    await cal.updateEvent({
      eventId: params.eventId as string,
      summary: params.summary as string | undefined,
      start: params.start as string | undefined,
      end: params.end as string | undefined,
      calendarId: params.calendarId as string | undefined,
    });
    return { status: 'updated' };
  });

  mcp.register('calendar_delete_event', async (params) => {
    await cal.deleteEvent({
      eventId: params.eventId as string,
      calendarId: params.calendarId as string | undefined,
    });
    return { status: 'deleted' };
  });

  mcp.register('calendar_respond_to_event', async (params) => {
    await cal.respondToEvent({
      eventId: params.eventId as string,
      response: params.response as 'accepted' | 'declined' | 'tentative',
      calendarId: params.calendarId as string | undefined,
    });
    return { status: 'responded' };
  });

  mcp.register('calendar_find_availability', async (params) => {
    return cal.findAvailability({
      timeMin: params.timeMin as string,
      timeMax: params.timeMax as string,
      durationMinutes: params.durationMinutes as number,
    });
  });

  // ── SHEETS ──────────────────────────────────────────────────────
  mcp.register('sheets_read', async (params) => {
    return sheets.readRange({
      spreadsheetId: params.spreadsheetId as string,
      range: params.range as string,
    });
  });

  mcp.register('sheets_append', async (params) => {
    return sheets.appendRows({
      spreadsheetId: params.spreadsheetId as string,
      range: params.range as string,
      values: params.values as string[][],
    });
  });

  mcp.register('sheets_update', async (params) => {
    return sheets.updateRange({
      spreadsheetId: params.spreadsheetId as string,
      range: params.range as string,
      values: params.values as string[][],
    });
  });
}
