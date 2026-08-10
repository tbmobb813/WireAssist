import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const WIREASSIST_HOME = process.env.WIREASSIST_HOME ?? os.homedir();
const TOKEN_PATH = path.join(WIREASSIST_HOME, '.wireassist', 'gmail-token.json');
const CREDENTIALS_PATH = path.join(WIREASSIST_HOME, '.wireassist', 'gmail-credentials.json');

// Reuses the same OAuth token as Gmail/Calendar — no second auth flow needed.
// Requires the `spreadsheets` scope, which is included in gmail-client.ts's
// SCOPES; a token predating that scope fails hasRequiredScopes() and
// gmail.authenticate() re-runs the OAuth flow automatically.
export class SheetsClient {
  private auth: OAuth2Client;
  private sheets: sheets_v4.Sheets;

  constructor() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`Credentials not found at ${CREDENTIALS_PATH}`);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed ?? credentials.web;

    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (!fs.existsSync(TOKEN_PATH)) {
      throw new Error('No OAuth token found. Run Gmail auth first — it covers Sheets too.');
    }

    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    this.auth.setCredentials(token);
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async readRange(params: { spreadsheetId: string; range: string }): Promise<{
    range: string;
    values: string[][];
  }> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: params.spreadsheetId,
      range: params.range,
    });

    return {
      range: res.data.range ?? params.range,
      values: (res.data.values ?? []) as string[][],
    };
  }

  async appendRows(params: {
    spreadsheetId: string;
    range: string;
    values: string[][];
  }): Promise<{ updatedRange: string }> {
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: params.spreadsheetId,
      range: params.range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: params.values },
    });

    return { updatedRange: res.data.updates?.updatedRange ?? params.range };
  }

  async updateRange(params: {
    spreadsheetId: string;
    range: string;
    values: string[][];
  }): Promise<{ updatedRange: string }> {
    const res = await this.sheets.spreadsheets.values.update({
      spreadsheetId: params.spreadsheetId,
      range: params.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: params.values },
    });

    return { updatedRange: res.data.updatedRange ?? params.range };
  }
}
