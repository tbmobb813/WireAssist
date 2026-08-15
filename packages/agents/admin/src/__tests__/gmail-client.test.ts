// Request-shape tests for the new getProfile()/getLastMessageInfo() methods,
// mocking googleapis and the filesystem (credentials/token) since there's no
// live Google OAuth available in CI — same confidence level as achievable
// without real credentials.

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({ setCredentials: jest.fn() })),
    },
    gmail: jest.fn().mockReturnValue({
      users: {
        getProfile: jest.fn(),
        threads: { get: jest.fn() },
      },
    }),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockImplementation((path: string) => {
    if (String(path).includes('gmail-credentials.json')) {
      return JSON.stringify({
        installed: {
          client_id: 'id',
          client_secret: 'secret',
          redirect_uris: ['http://localhost:53682/callback'],
        },
      });
    }
    return JSON.stringify({ scope: 'https://www.googleapis.com/auth/gmail.readonly' });
  }),
  writeFileSync: jest.fn(),
  chmodSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import { google } from 'googleapis';
import { GmailClient } from '../gmail-client';

// google.gmail() is a mockReturnValue — every call (including the one the
// GmailClient constructor makes internally) returns this exact same object.
const mockGmailUsers = (google.gmail as unknown as jest.Mock)({}).users as {
  getProfile: jest.Mock;
  threads: { get: jest.Mock };
};

describe('GmailClient.getProfile()', () => {
  beforeEach(() => {
    mockGmailUsers.getProfile.mockReset();
    mockGmailUsers.threads.get.mockReset();
  });

  it('returns the account email address from users.getProfile', async () => {
    mockGmailUsers.getProfile.mockResolvedValue({ data: { emailAddress: 'jason@example.com' } });
    const client = new GmailClient();

    const result = await client.getProfile();

    expect(mockGmailUsers.getProfile).toHaveBeenCalledWith({ userId: 'me' });
    expect(result).toEqual({ emailAddress: 'jason@example.com' });
  });

  it('falls back to an empty string when the API omits emailAddress', async () => {
    mockGmailUsers.getProfile.mockResolvedValue({ data: {} });
    const client = new GmailClient();

    const result = await client.getProfile();

    expect(result).toEqual({ emailAddress: '' });
  });
});

describe('GmailClient.getLastMessageInfo()', () => {
  beforeEach(() => {
    mockGmailUsers.getProfile.mockReset();
    mockGmailUsers.threads.get.mockReset();
  });

  it('requests metadata format and returns the last message From/Date headers', async () => {
    mockGmailUsers.threads.get.mockResolvedValue({
      data: {
        messages: [
          {
            payload: {
              headers: [
                { name: 'From', value: 'other@example.com' },
                { name: 'Date', value: 'Mon, 1 Jan 2024 00:00:00 +0000' },
              ],
            },
          },
          {
            payload: {
              headers: [
                { name: 'From', value: 'jason@example.com' },
                { name: 'Date', value: 'Tue, 2 Jan 2024 00:00:00 +0000' },
              ],
            },
          },
        ],
      },
    });
    const client = new GmailClient();

    const result = await client.getLastMessageInfo('thread-1');

    expect(mockGmailUsers.threads.get).toHaveBeenCalledWith({
      userId: 'me',
      id: 'thread-1',
      format: 'metadata',
      metadataHeaders: ['From', 'Date'],
    });
    // Must be the LAST message, not the first.
    expect(result).toEqual({
      from: 'jason@example.com',
      date: 'Tue, 2 Jan 2024 00:00:00 +0000',
    });
  });

  it('returns null when the thread has no messages', async () => {
    mockGmailUsers.threads.get.mockResolvedValue({ data: { messages: [] } });
    const client = new GmailClient();

    const result = await client.getLastMessageInfo('thread-1');

    expect(result).toBeNull();
  });
});
