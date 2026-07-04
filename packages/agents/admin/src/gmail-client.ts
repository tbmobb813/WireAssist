import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import { spawn } from 'child_process';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

const HOME_PATH = process.env.WIREASSIST_HOME ?? os.homedir();
const TOKEN_PATH = path.join(HOME_PATH, '.wireassist', 'gmail-token.json');
const CREDENTIALS_PATH = path.join(HOME_PATH, '.wireassist', 'gmail-credentials.json');

export class GmailClient {
  private auth: OAuth2Client;
  private gmail: gmail_v1.Gmail;
  private redirectUri: URL;

  constructor() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(
        `Gmail credentials not found at ${CREDENTIALS_PATH}.\n` +
          `Download from Google Cloud Console → APIs & Services → Credentials.`
      );
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed ?? credentials.web;

    this.redirectUri = new URL(redirect_uris[0]);
    this.auth = new google.auth.OAuth2(client_id, client_secret, this.redirectUri.toString());
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  // Call once to authenticate — opens browser, saves token
  async authenticate(options?: { forceReauth?: boolean }): Promise<void> {
    if (options?.forceReauth) {
      await this.runOAuthFlow();
      return;
    }

    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      if (!this.hasRequiredScopes(token.scope)) {
        console.log(
          '\n⚠️  Existing token is missing required Gmail/Calendar scopes. Re-authorizing...'
        );
        await this.runOAuthFlow();
        return;
      }

      this.auth.setCredentials(token);

      // Refresh if expired
      if (token.expiry_date && token.expiry_date < Date.now()) {
        const { credentials } = await this.auth.refreshAccessToken();
        const merged = {
          ...token,
          ...credentials,
          // Some refresh responses omit scope; preserve the existing granted scope string.
          scope: credentials.scope ?? token.scope,
        };
        this.saveToken(merged);
        this.auth.setCredentials(merged);
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
        include_granted_scopes: true,
        prompt: 'consent',
      });

      console.log('\n🔐 Opening browser for Gmail authorization...');
      console.log('If it does not open automatically, visit:\n', authUrl);

      // Start a local server to catch the OAuth callback
      const server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith(this.redirectUri.pathname)) return;

        const qs = new URL(req.url, this.redirectUri.origin).searchParams;
        const code = qs.get('code');
        const error = qs.get('error');

        // Ignore requests with no OAuth params (browser prefetch, favicon, etc.)
        if (!code && !error) return;

        res.end(
          error
            ? '<h1>❌ Authorization failed. You can close this tab.</h1>'
            : '<h1>✅ WireAssist authorized. You can close this tab.</h1>'
        );
        server.close();

        if (error || !code) {
          reject(new Error(error ?? 'No OAuth code received'));
          return;
        }

        const { tokens } = await this.auth.getToken(code);
        this.auth.setCredentials(tokens);
        this.saveToken(tokens);
        console.log('✅ Gmail authenticated and token saved.\n');
        resolve();
      });

      const port = this.redirectUri.port
        ? Number(this.redirectUri.port)
        : this.redirectUri.protocol === 'https:'
          ? 443
          : 80;

      server.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          reject(
            new Error(
              `OAuth callback port ${port} is already in use. Close the other process using this port and retry.`
            )
          );
          return;
        }

        reject(error);
      });

      server.listen(port, this.redirectUri.hostname, () => {
        const opener =
          process.platform === 'darwin'
            ? { command: 'open', args: [authUrl] }
            : process.platform === 'win32'
              ? { command: 'cmd', args: ['/c', 'start', '', authUrl] }
              : { command: 'xdg-open', args: [authUrl] };
        const child = spawn(opener.command, opener.args, { detached: true, stdio: 'ignore' });
        child.on('error', (error) => {
          console.error('Failed to open browser automatically:', error.message);
          console.log('Open this URL manually:\n', authUrl);
        });
        child.unref();
      });
    });
  }

  private saveToken(token: object): void {
    const dir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    fs.chmodSync(TOKEN_PATH, 0o600);
  }

  private hasRequiredScopes(scopeClaim: unknown): boolean {
    if (typeof scopeClaim !== 'string' || scopeClaim.trim() === '') {
      return false;
    }

    const granted = new Set(scopeClaim.split(/\s+/).filter(Boolean));
    return SCOPES.every((scope) => granted.has(scope));
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

    return (res.data.threads ?? []).map((t: gmail_v1.Schema$Thread) => ({
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

    const from =
      headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'From')?.value ?? 'Unknown';
    const subject =
      headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Subject')?.value ??
      '(no subject)';
    const date =
      headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === 'Date')?.value ?? '';

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

  async labelThread(params: { threadId: string; labelName: string }): Promise<void> {
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
    const existing = res.data.labels?.find((l: gmail_v1.Schema$Label) => l.name === name);
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
      return this.decodeBase64Url(payload.body.data);
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const text = this.extractBody(part);
        if (text) return text;
      }
    }

    return '';
  }

  private decodeBase64Url(data: string): string {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    try {
      return Buffer.from(normalized + '='.repeat(padding), 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
}
