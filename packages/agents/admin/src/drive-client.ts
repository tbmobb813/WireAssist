import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const WIREASSIST_HOME = process.env.WIREASSIST_HOME ?? os.homedir();
const TOKEN_PATH = path.join(WIREASSIST_HOME, '.wireassist', 'gmail-token.json');
const CREDENTIALS_PATH = path.join(WIREASSIST_HOME, '.wireassist', 'gmail-credentials.json');

// Reuses the same OAuth token as Gmail/Calendar/Sheets — no second auth flow
// needed. Requires the `drive.file` scope (access limited to files this app
// itself creates or opens — not the user's whole Drive), which is included
// in gmail-client.ts's SCOPES; a token predating that scope fails
// hasRequiredScopes() and gmail.authenticate() re-runs the OAuth flow
// automatically, same as the Calendar/Sheets scope additions before it.
//
// Content goes in as plain text and Drive converts it to a native Google Doc
// on upload (mimeType: 'application/vnd.google-apps.document' + a text/plain
// media body) — no separate Docs API client needed for this scope of work.
export class DriveClient {
  private auth: OAuth2Client;
  private drive: drive_v3.Drive;

  constructor() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`Credentials not found at ${CREDENTIALS_PATH}`);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed ?? credentials.web;

    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (!fs.existsSync(TOKEN_PATH)) {
      throw new Error('No OAuth token found. Run Gmail auth first — it covers Drive too.');
    }

    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    this.auth.setCredentials(token);
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async createDoc(params: {
    title: string;
    content: string;
    folderId?: string;
  }): Promise<{ id: string; webViewLink: string }> {
    const res = await this.drive.files.create({
      requestBody: {
        name: params.title,
        mimeType: 'application/vnd.google-apps.document',
        parents: params.folderId ? [params.folderId] : undefined,
      },
      media: {
        mimeType: 'text/plain',
        body: params.content,
      },
      fields: 'id, webViewLink',
    });

    if (!res.data.id) throw new Error('Drive did not return a file id for the created doc.');
    return { id: res.data.id, webViewLink: res.data.webViewLink ?? '' };
  }

  async updateDoc(params: { fileId: string; content: string }): Promise<{ id: string }> {
    const res = await this.drive.files.update({
      fileId: params.fileId,
      media: {
        mimeType: 'text/plain',
        body: params.content,
      },
      fields: 'id',
    });

    if (!res.data.id) throw new Error('Drive did not return a file id for the updated doc.');
    return { id: res.data.id };
  }

  async readDoc(params: { fileId: string }): Promise<{ content: string }> {
    const res = await this.drive.files.export(
      { fileId: params.fileId, mimeType: 'text/plain' },
      { responseType: 'text' }
    );
    return { content: (res.data as unknown as string) ?? '' };
  }

  async searchFiles(params: {
    query: string;
    maxResults?: number;
  }): Promise<{ id: string; name: string; webViewLink?: string }[]> {
    const res = await this.drive.files.list({
      q: params.query,
      pageSize: params.maxResults ?? 10,
      fields: 'files(id, name, webViewLink)',
    });

    return (res.data.files ?? []).map((f) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      webViewLink: f.webViewLink ?? undefined,
    }));
  }
}
