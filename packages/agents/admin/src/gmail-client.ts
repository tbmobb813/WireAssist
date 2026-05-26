import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
];

const TOKEN_PATH = path.join(process.env.HOME ?? '~', '.synqworks', 'gmail-token.json');
const CREDENTIALS_PATH = path.join(process.env.HOME ?? '~', '.synqworks', 'gmail-credentials.json');

export class GmailClient {
  private auth: OAuth2Client;
  private gmail: gmail_v1.Gmail;

  constructor() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(
        `Gmail credentials not found at ${CREDENTIALS_PATH}.\n` +
        `Download from Google Cloud Console → APIs & Services → Credentials.`
      );
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed ?? credentials.web;

    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  // Call once to authenticate — opens browser, saves token
  async authenticate(): Promise<void> {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      this.auth.setCredentials(token);

      // Refresh if expired
      if (token.expiry_date && token.expiry_date < Date.now()) {
        const { credentials } = await this.auth.refreshAccessToken();
        this.saveToken(credentials);
        this.auth.setCredentials(credentials);
      }
      return;
    }

    await this.runOAuthFlow();
  }

  private async runOAuthFlow(): Promise<void> {
    return new Promise((resolve, reject) => {
      const authUrl = this.auth.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });

      console.log('\n🔐 Opening browser for Gmail authorization...');
      console.log('If it does not open automatically, visit:\n', authUrl);

      // Start a local server to catch the OAuth callback
      const server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith('/oauth2callback')) return;

        const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
        const code = qs.get('code');

        res.end('<h1>✅ SynqWorks authorized. You can close this tab.</h1>');
        server.close();

        if (!code) {
          reject(new Error('No OAuth code received'));
          return;
        }

        const { tokens } = await this.auth.getToken(code);
        this.auth.setCredentials(tokens);
        this.saveToken(tokens);
        console.log('✅ Gmail authenticated and token saved.\n');
        resolve();
      });

      server.listen(3000, () => {
        const open = require('child_process').exec;
        open(`xdg-open "${authUrl}" || open "${authUrl}" || start "${authUrl}"`);
      });
    });
  }

  private saveToken(token: object): void {
    const dir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  }

  // ─── GMAIL METHODS ─────────────────────────────────────────────

  async listThreads(params: {
    maxResults?: number;
    labelIds?: string[];
    q?: string;
  }): Promise<{ id: string; snippet: string }[]> {
    const res = await this.gmail.users.threads.list({
      userId: 'me',
      maxResults: params.maxResults ?? 20,
      labelIds: params.labelIds,
      q: params.q,
    });

    return (res.data.threads ?? []).map(t => ({
      id: t.id!,
      snippet: t.snippet ?? '',
    }));
  }

  async getThread(threadId: string): Promise<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    body: string;
  }> {
    const res = await this.gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    const thread = res.data;
    const firstMessage = thread.messages?.[0];
    const headers = firstMessage?.payload?.headers ?? [];

    const from = headers.find(h => h.name === 'From')?.value ?? 'Unknown';
    const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)';
    const date = headers.find(h => h.name === 'Date')?.value ?? '';

    // Extract plain text body
    const body = this.extractBody(firstMessage?.payload);

    return {
      id: threadId,
      from,
      subject,
      snippet: thread.snippet ?? '',
      date,
      body: body.slice(0, 2000), // Cap at 2k chars to avoid token bloat
    };
  }

  async createDraft(params: {
    threadId?: string;
    to?: string;
    subject?: string;
    body: string;
  }): Promise<{ draftId: string }> {
    // Build RFC 2822 message
    const messageParts = [
      params.to ? `To: ${params.to}` : '',
      params.subject ? `Subject: ${params.subject}` : '',
      'Content-Type: text/plain; charset=utf-8',
      '',
      params.body,
    ].filter(Boolean);

    const raw = Buffer.from(messageParts.join('\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw,
          threadId: params.threadId,
        },
      },
    });

    return { draftId: res.data.id! };
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<{ messageId: string }> {
    const messageParts = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      params.body,
    ];

    const raw = Buffer.from(messageParts.join('\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: params.threadId },
    });

    return { messageId: res.data.id! };
  }

  async labelThread(params: {
    threadId: string;
    labelName: string;
  }): Promise<void> {
    // Get or create the label
    const labelId = await this.getOrCreateLabel(params.labelName);

    await this.gmail.users.threads.modify({
      userId: 'me',
      id: params.threadId,
      requestBody: { addLabelIds: [labelId] },
    });
  }

  private async getOrCreateLabel(name: string): Promise<string> {
    const res = await this.gmail.users.labels.list({ userId: 'me' });
    const existing = res.data.labels?.find(l => l.name === name);
    if (existing?.id) return existing.id;

    const created = await this.gmail.users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    });
    return created.data.id!;
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const text = this.extractBody(part);
        if (text) return text;
      }
    }

    return payload.snippet ?? '';
  }
}