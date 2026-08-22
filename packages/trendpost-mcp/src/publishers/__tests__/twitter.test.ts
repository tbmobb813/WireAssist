// Mocks twitter-api-v2 at the module boundary — no live Twitter API
// available in CI, same confidence level as gmail-client.test.ts's approach
// for googleapis.

const mockTweet = jest.fn();
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({ v2: { tweet: mockTweet } })),
}));

import { TwitterApi } from 'twitter-api-v2';
import { postToTwitter } from '../twitter';

const ENV_VARS = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET',
];

describe('postToTwitter()', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWITTER_API_KEY = 'key';
    process.env.TWITTER_API_SECRET = 'secret';
    process.env.TWITTER_ACCESS_TOKEN = 'token';
    process.env.TWITTER_ACCESS_SECRET = 'token-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('constructs the client with the four env-var credentials', async () => {
    mockTweet.mockResolvedValue({ data: { id: 'tw-1', text: 'hi' } });

    await postToTwitter('hello world');

    expect(TwitterApi).toHaveBeenCalledWith({
      appKey: 'key',
      appSecret: 'secret',
      accessToken: 'token',
      accessSecret: 'token-secret',
    });
  });

  it('tweets the post content and maps the tweet id to platformPostId', async () => {
    mockTweet.mockResolvedValue({ data: { id: 'tw-42', text: 'hello world' } });

    const result = await postToTwitter('hello world');

    expect(mockTweet).toHaveBeenCalledWith('hello world');
    expect(result).toEqual({
      platformPostId: 'tw-42',
      url: 'https://twitter.com/i/web/status/tw-42',
    });
  });

  it.each(ENV_VARS)(
    'throws a clear error naming the missing credential when %s is unset',
    async (name) => {
      delete process.env[name];
      await expect(postToTwitter('hello')).rejects.toThrow(new RegExp(name));
      expect(mockTweet).not.toHaveBeenCalled();
    }
  );
});
