export const PLATFORMS = ['twitter', 'linkedin', 'instagram', 'threads'] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface ScheduledPost {
  id: string;
  content: string;
  platform: Platform;
  scheduledAt: string;
  status: string;
  tags: string[];
  campaignId?: string;
  category?: string;
  contentPillar?: string;
}

export interface ContentIdea {
  id: string;
  topic: string;
  angle: string;
  platform: Platform;
  status: string;
  createdAt: string;
  scheduledFor?: string;
  campaignId?: string;
  category?: string;
  contentPillar?: string;
}

export interface Campaign {
  id: string;
  name: string;
  source: 'manual' | 'gtm';
  createdAt: string;
}

// A reusable, named set of hashtags — plain reference data managed directly
// via CRUD (see HashtagGroup in trendpost-mcp's storage.ts for why this
// isn't agent-mediated). characterCount is derived server-side from
// hashtags.length, never stored, so it can't go stale.
export interface HashtagGroup {
  id: string;
  name: string;
  hashtags: string;
  createdAt: string;
  characterCount: number;
}

export type CalendarItem =
  | { kind: 'post'; date: Date; post: ScheduledPost }
  | { kind: 'idea'; date: Date; idea: ContentIdea };

export const platformColor: Record<string, string> = {
  twitter: '#1da1f2',
  linkedin: '#0077b5',
  instagram: '#e1306c',
  threads: '#94a3b8',
};
