import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SYNQWORKS_HOME = process.env.SYNQWORKS_HOME ?? os.homedir();
const TOKEN_PATH = path.join(SYNQWORKS_HOME, '.synqworks', 'gmail-token.json');
const CREDENTIALS_PATH = path.join(SYNQWORKS_HOME, '.synqworks', 'gmail-credentials.json');

// Reuses the same OAuth token as Gmail — no second auth flow needed
export class CalendarClient {
  private auth: OAuth2Client;
  private calendar: calendar_v3.Calendar;

  constructor() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`Credentials not found at ${CREDENTIALS_PATH}`);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed ?? credentials.web;

    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (!fs.existsSync(TOKEN_PATH)) {
      throw new Error('No OAuth token found. Run Gmail auth first — it covers Calendar too.');
    }

    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    this.auth.setCredentials(token);
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async listEvents(params: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    calendarId?: string;
  }): Promise<CalendarEvent[]> {
    const res = await this.calendar.events.list({
      calendarId: params.calendarId ?? 'primary',
      timeMin: params.timeMin ?? new Date().toISOString(),
      timeMax: params.timeMax,
      maxResults: params.maxResults ?? 20,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (res.data.items ?? []).flatMap((e) => {
      const start = e.start?.dateTime ?? e.start?.date;
      const end = e.end?.dateTime ?? e.end?.date;

      if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
        return [];
      }

      return [{
        id: e.id!,
        summary: e.summary ?? '(no title)',
        start,
        end,
        attendees: (e.attendees ?? [])
          .filter((a): a is calendar_v3.Schema$EventAttendee & { email: string } => typeof a.email === 'string')
          .map(a => ({ email: a.email })),
        description: e.description ?? '',
        location: e.location ?? '',
        status: e.status ?? 'confirmed',
      }];
    });
  }

  async createEvent(params: {
    summary: string;
    start: string;
    end: string;
    attendees?: string[];
    description?: string;
    location?: string;
    calendarId?: string;
  }): Promise<{ eventId: string; htmlLink: string }> {
    const res = await this.calendar.events.insert({
      calendarId: params.calendarId ?? 'primary',
      requestBody: {
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: { dateTime: params.start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: params.end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        attendees: (params.attendees ?? []).map(email => ({ email })),
      },
    });

    return {
      eventId: res.data.id!,
      htmlLink: res.data.htmlLink!,
    };
  }

  async updateEvent(params: {
    eventId: string;
    summary?: string;
    start?: string;
    end?: string;
    description?: string;
    calendarId?: string;
  }): Promise<void> {
    await this.calendar.events.patch({
      calendarId: params.calendarId ?? 'primary',
      eventId: params.eventId,
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: params.start ? { dateTime: params.start } : undefined,
        end: params.end ? { dateTime: params.end } : undefined,
      },
    });
  }

  async deleteEvent(params: {
    eventId: string;
    calendarId?: string;
  }): Promise<void> {
    await this.calendar.events.delete({
      calendarId: params.calendarId ?? 'primary',
      eventId: params.eventId,
    });
  }

  async findAvailability(params: {
    timeMin: string;
    timeMax: string;
    durationMinutes: number;
  }): Promise<AvailableSlot[]> {
    // Get all events in the window
    const events = await this.listEvents({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults: 50,
    });

    const slots: AvailableSlot[] = [];
    const windowStart = new Date(params.timeMin);
    const windowEnd = new Date(params.timeMax);
    const duration = params.durationMinutes * 60 * 1000;

    // Work hours: 9am–6pm in local timezone
    const workStart = 9;
    const workEnd = 18;

    let cursor = new Date(windowStart);

    while (cursor < windowEnd) {
      const hour = cursor.getHours();

      // Skip outside work hours
      if (hour < workStart || hour >= workEnd) {
        cursor = new Date(cursor);
        cursor.setHours(hour < workStart ? workStart : workStart + 24, 0, 0, 0);
        continue;
      }

      const slotEnd = new Date(cursor.getTime() + duration);
      const workdayEnd = new Date(cursor);
      workdayEnd.setHours(workEnd, 0, 0, 0);

      // Check if this slot conflicts with any event
      const hasConflict = events.some(e => {
        const eStart = new Date(e.start);
        const eEnd = new Date(e.end);
        return cursor < eEnd && slotEnd > eStart;
      });

      if (!hasConflict && slotEnd <= workdayEnd) {
        slots.push({
          start: cursor.toISOString(),
          end: slotEnd.toISOString(),
        });
      }

      // Advance by 30 minutes
      cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
    }

    // Return first 5 available slots
    return slots.slice(0, 5);
  }
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: { email: string }[];
  description: string;
  location: string;
  status: string;
}

export interface AvailableSlot {
  start: string;
  end: string;
}