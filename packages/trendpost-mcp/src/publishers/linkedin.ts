import type { PublishResult, PostMetrics } from './index';

const REQUIRED_VARS = ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_PERSON_URN'] as const;

export async function postToLinkedin(content: string): Promise<PublishResult> {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing LinkedIn credentials: ${missing.join(', ')}. Set them in .env — see ` +
        `docs/DEPLOYMENT.md's "Getting platform API credentials" section.`
    );
  }

  const personUrn = process.env.LINKEDIN_PERSON_URN!;
  const author = personUrn.startsWith('urn:li:person:') ? personUrn : `urn:li:person:${personUrn}`;

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  if (!res.ok) {
    throw new Error(`LinkedIn publish failed (${res.status}): ${await res.text()}`);
  }

  // LinkedIn returns the created post's ID in the x-restli-id response
  // header, with an empty (or minimal) response body — fall back to a JSON
  // `id` field in case that ever changes.
  const headerId = res.headers.get('x-restli-id');
  if (headerId) return { platformPostId: headerId };

  const body = (await res.json().catch(() => ({}))) as { id?: string };
  if (body.id) return { platformPostId: body.id };

  throw new Error('LinkedIn publish succeeded but no post ID was returned.');
}

// LinkedIn's socialActions API needs a broader scope (r_organization_social
// or similar) than the w_member_social scope this integration currently
// requests for publishing — as of this writing the access token in use
// almost certainly cannot read this. Left implemented (not stubbed out)
// so it starts working the moment the token gains that scope, without a
// code change — but expect this to throw in practice until then. The
// caller treats any throw here as "not available for this post."
export async function fetchLinkedinMetrics(platformPostId: string): Promise<PostMetrics> {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing LinkedIn credentials: ${missing.join(', ')}.`);
  }

  const res = await fetch(
    `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(platformPostId)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );
  if (!res.ok) {
    throw new Error(
      `LinkedIn metrics fetch failed (${res.status}): ${await res.text()} — likely needs a ` +
        'broader OAuth scope than this token currently has.'
    );
  }

  const body = (await res.json()) as {
    likesSummary?: { totalLikes?: number };
    commentsSummary?: { totalFirstLevelComments?: number };
  };

  return {
    likes: body.likesSummary?.totalLikes,
    comments: body.commentsSummary?.totalFirstLevelComments,
    raw: { ...body },
  };
}
