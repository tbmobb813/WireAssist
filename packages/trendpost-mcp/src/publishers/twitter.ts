import { TwitterApi } from 'twitter-api-v2';
import type { PublishResult, PostMetrics } from './index';

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

// Reading public_metrics generally requires a paid API tier (the free tier
// often can't read tweet.fields=public_metrics at all) — a 403 here is a
// tier problem, not a bug, and the caller (check-post-metrics.ts) treats
// any throw from this function as "not available for this post" rather
// than a hard failure.
export async function fetchTwitterMetrics(platformPostId: string): Promise<PostMetrics> {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing Twitter credentials: ${missing.join(', ')}.`);
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  const tweet = await client.v2.singleTweet(platformPostId, {
    'tweet.fields': ['public_metrics'],
  });
  const metrics = tweet.data.public_metrics;
  if (!metrics) {
    throw new Error(`Twitter returned no public_metrics for tweet ${platformPostId}.`);
  }

  return {
    likes: metrics.like_count,
    views: metrics.impression_count,
    comments: metrics.reply_count,
    shares: metrics.retweet_count,
    raw: { ...metrics },
  };
}
