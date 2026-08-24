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
}

export interface Campaign {
  id: string;
  name: string;
  source: 'manual' | 'gtm';
  createdAt: string;
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
