import { TwitterApi } from 'twitter-api-v2';
import type { PublishResult } from './index';

const REQUIRED_VARS = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET',
] as const;

export async function postToTwitter(content: string): Promise<PublishResult> {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Twitter credentials: ${missing.join(', ')}. Set them in .env — see ` +
        `docs/DEPLOYMENT.md's "Getting platform API credentials" section.`
    );
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  const { data } = await client.v2.tweet(content);

  return {
    platformPostId: data.id,
    url: `https://twitter.com/i/web/status/${data.id}`,
  };
}
