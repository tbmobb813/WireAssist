import type { Platform } from '../storage';
import { postToTwitter, fetchTwitterMetrics } from './twitter';
import { postToLinkedin, fetchLinkedinMetrics } from './linkedin';
import {
  postToFacebook,
  postToInstagram,
  fetchFacebookMetrics,
  fetchInstagramMetrics,
} from './meta';

export interface PublishResult {
  platformPostId: string;
  url?: string;
}

// Normalized engagement — every field optional since no platform returns
// all four, and a platform call that fails entirely should throw rather
// than return an empty PostMetrics (see each fetch*Metrics function's own
// comment on why: the caller needs to distinguish "checked, nothing to
// report" from "the check itself failed").
export interface PostMetrics {
  likes?: number;
  views?: number;
  comments?: number;
  shares?: number;
  raw?: Record<string, unknown>;
}

export async function publishToPlatform(
  platform: Platform,
  content: string,
  // Which specific brand/account to publish as — only Meta (Facebook/
  // Instagram) credentials are account-scoped today, since that's the
  // actual multi-brand need (see meta.ts's resolveCredential). Twitter/
  // LinkedIn still publish through one single global account regardless
  // of this value; accepted here anyway so every platform has the same
  // call signature rather than a special case for two of them.
  account?: string
): Promise<PublishResult> {
  switch (platform) {
    case 'twitter':
      return postToTwitter(content);
    case 'linkedin':
      return postToLinkedin(content);
    case 'facebook':
      return postToFacebook(content, account);
    case 'instagram':
      return postToInstagram(content, account);
    case 'threads':
      // Threads' API requires a separate, more restrictive Meta app
      // approval process not covered by the credentials this package
      // reads — fail clearly rather than silently dropping the post.
      throw new Error('Unsupported platform for publishing: threads');
  }
}

// Threads has no fetchThreadsMetrics counterpart — publishToPlatform
// already refuses to publish to threads at all (unsupported), so there's
// never a threads post with a platformPostId to look up metrics for.
export async function fetchMetricsForPlatform(
  platform: Platform,
  platformPostId: string,
  account?: string
): Promise<PostMetrics> {
  switch (platform) {
    case 'twitter':
      return fetchTwitterMetrics(platformPostId);
    case 'linkedin':
      return fetchLinkedinMetrics(platformPostId);
    case 'facebook':
      return fetchFacebookMetrics(platformPostId, account);
    case 'instagram':
      return fetchInstagramMetrics(platformPostId, account);
    case 'threads':
      throw new Error('Metrics are not available for threads.');
  }
}

export { postToTwitter, fetchTwitterMetrics } from './twitter';
export { postToLinkedin, fetchLinkedinMetrics } from './linkedin';
export {
  postToFacebook,
  postToInstagram,
  fetchFacebookMetrics,
  fetchInstagramMetrics,
} from './meta';
