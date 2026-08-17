import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOME_PATH = process.env.WIREASSIST_HOME ?? os.homedir();
const CREDENTIALS_PATH = path.join(HOME_PATH, '.wireassist', 'wordpress-credentials.json');

interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface DraftPostInput {
  title: string;
  contentHtml: string;
  excerpt?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  featuredMediaId?: number;
}

export interface DraftPostResult {
  id: number;
  status: string;
  link: string;
  editLink: string;
}

export interface UploadMediaInput {
  imageBuffer: Buffer;
  mimeType: string;
  filename: string;
  altText?: string;
}

export interface UploadMediaResult {
  id: number;
  sourceUrl: string;
}

export interface RecentPost {
  id: number;
  title: string;
  link: string;
}

function loadCredentials(): WordPressCredentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `WordPress credentials not found at ${CREDENTIALS_PATH}.\n` +
        `Create it with: { "siteUrl": "https://example.com", "username": "<wp-username>", ` +
        `"applicationPassword": "<application password from WP admin → Users → Profile → Application Passwords>" }`
    );
  }
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) as WordPressCredentials;
  if (!creds.siteUrl || !creds.username || !creds.applicationPassword) {
    throw new Error(
      `WordPress credentials at ${CREDENTIALS_PATH} are missing one of: siteUrl, username, applicationPassword.`
    );
  }
  return creds;
}

export class WordPressClient {
  private creds: WordPressCredentials;

  constructor() {
    this.creds = loadCredentials();
  }

  // WP Application Passwords use HTTP Basic auth over the REST API — no
  // OAuth app, no third-party review, unlike every social platform's API.
  private authHeader(): string {
    const token = Buffer.from(`${this.creds.username}:${this.creds.applicationPassword}`).toString(
      'base64'
    );
    return `Basic ${token}`;
  }

  // Creates the post as a draft, never 'publish' — going live stays a
  // separate, human action taken inside WordPress itself.
  async createDraftPost(input: DraftPostInput): Promise<DraftPostResult> {
    const base = this.creds.siteUrl.replace(/\/+$/, '');
    const body: Record<string, unknown> = {
      title: input.title,
      content: input.contentHtml,
      status: 'draft',
    };
    if (input.excerpt) body.excerpt = input.excerpt;
    if (input.slug) body.slug = input.slug;
    // Only registers if the site has a plugin exposing these meta keys to
    // REST (e.g. Yoast SEO with its REST support enabled) — WP silently
    // ignores unregistered meta keys rather than erroring, so this is safe
    // to send unconditionally and just won't take effect on a bare install.
    if (input.metaTitle || input.metaDescription) {
      body.meta = {
        ...(input.metaTitle ? { _yoast_wpseo_title: input.metaTitle } : {}),
        ...(input.metaDescription ? { _yoast_wpseo_metadesc: input.metaDescription } : {}),
      };
    }
    if (input.featuredMediaId) body.featured_media = input.featuredMediaId;

    const response = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `WordPress draft creation failed (${response.status}): ${text.slice(0, 500)}`
      );
    }

    const post = (await response.json()) as {
      id: number;
      status: string;
      link: string;
    };

    return {
      id: post.id,
      status: post.status,
      link: post.link,
      editLink: `${base}/wp-admin/post.php?post=${post.id}&action=edit`,
    };
  }

  // Uploads raw image bytes to the media library. Used for both the
  // featured image and any inline images an article needs — WP returns a
  // real, hosted URL that can go straight into post content.
  async uploadMedia(input: UploadMediaInput): Promise<UploadMediaResult> {
    const base = this.creds.siteUrl.replace(/\/+$/, '');
    const response = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': input.mimeType,
        'Content-Disposition': `attachment; filename="${input.filename}"`,
      },
      body: input.imageBuffer,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`WordPress media upload failed (${response.status}): ${text.slice(0, 500)}`);
    }

    const media = (await response.json()) as { id: number; source_url: string };

    if (input.altText) {
      // Best-effort — alt text isn't required for the upload to succeed,
      // so a failure here shouldn't fail the whole image.
      await fetch(`${base}/wp-json/wp/v2/media/${media.id}`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alt_text: input.altText }),
      }).catch(() => {});
    }

    return { id: media.id, sourceUrl: media.source_url };
  }

  // Public endpoint, no auth needed — real published posts, for matching
  // internal-link candidates against actual existing content instead of
  // inventing URLs.
  async listRecentPosts(limit = 100): Promise<RecentPost[]> {
    const base = this.creds.siteUrl.replace(/\/+$/, '');
    const response = await fetch(
      `${base}/wp-json/wp/v2/posts?per_page=${limit}&_fields=id,title,link&status=publish`
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`WordPress post listing failed (${response.status}): ${text.slice(0, 500)}`);
    }

    const posts = (await response.json()) as Array<{
      id: number;
      title: { rendered: string };
      link: string;
    }>;

    return posts.map((p) => ({ id: p.id, title: p.title.rendered, link: p.link }));
  }
}
