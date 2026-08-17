import type { PublishResult } from './index';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

function requireEnv(names: string[]): void {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Meta credentials: ${missing.join(', ')}. Set them in .env — see ` +
        `docs/DEPLOYMENT.md's "Getting platform API credentials" section.`
    );
  }
}

async function graphPost(path: string, params: Record<string, string>): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.id) {
    throw new Error(
      `Meta Graph API request to ${path} failed: ${body.error?.message ?? res.statusText}`
    );
  }
  return { id: body.id };
}

export async function postToFacebook(content: string): Promise<PublishResult> {
  requireEnv(['META_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID']);

  const { id } = await graphPost(`${process.env.FACEBOOK_PAGE_ID}/feed`, {
    message: content,
    access_token: process.env.META_ACCESS_TOKEN!,
  });

  return { platformPostId: id, url: `https://www.facebook.com/${id}` };
}

export async function postToInstagram(content: string): Promise<PublishResult> {
  requireEnv(['META_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_DEFAULT_IMAGE_URL']);

  // Instagram feed posts require Graph API's two-step flow: create a media
  // container with an image, then publish that container. There's no
  // single-call "just post text" option — unlike Facebook.
  const container = await graphPost(`${process.env.INSTAGRAM_ACCOUNT_ID}/media`, {
    image_url: process.env.INSTAGRAM_DEFAULT_IMAGE_URL!,
    caption: content,
    access_token: process.env.META_ACCESS_TOKEN!,
  });

  const published = await graphPost(`${process.env.INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    creation_id: container.id,
    access_token: process.env.META_ACCESS_TOKEN!,
  });

  return { platformPostId: published.id };
}
