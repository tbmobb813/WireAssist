import type { Platform } from '../storage';
import { postToTwitter } from './twitter';
import { postToLinkedin } from './linkedin';
import { postToFacebook, postToInstagram } from './meta';

export interface PublishResult {
  platformPostId: string;
  url?: string;
}

export async function publishToPlatform(
  platform: Platform,
  content: string
): Promise<PublishResult> {
  switch (platform) {
    case 'twitter':
      return postToTwitter(content);
    case 'linkedin':
      return postToLinkedin(content);
    case 'facebook':
      return postToFacebook(content);
    case 'instagram':
      return postToInstagram(content);
    case 'threads':
      // Threads' API requires a separate, more restrictive Meta app
      // approval process not covered by the credentials this package
      // reads — fail clearly rather than silently dropping the post.
      throw new Error('Unsupported platform for publishing: threads');
  }
}

export { postToTwitter } from './twitter';
export { postToLinkedin } from './linkedin';
export { postToFacebook, postToInstagram } from './meta';
