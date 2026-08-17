import type { RecentPost } from './wordpress-client';

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'to',
  'in',
  'on',
  'for',
  'and',
  'or',
  'is',
  'are',
  'our',
  'your',
  'what',
  'how',
  'why',
  'with',
  'best',
  'guide',
  'page',
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

// Deterministic, not LLM-judged — a real internal link is either a good
// keyword match against an actual post title or it doesn't happen at all.
// No model call means no risk of it inventing a plausible-looking URL for
// a post that doesn't exist.
export function findBestMatch(topic: string, posts: RecentPost[]): RecentPost | null {
  const topicWords = significantWords(topic);
  if (topicWords.size === 0) return null;

  let best: RecentPost | null = null;
  let bestScore = 0;

  for (const post of posts) {
    const titleWords = significantWords(post.title);
    let overlap = 0;
    for (const w of topicWords) {
      if (titleWords.has(w)) overlap++;
    }
    if (overlap > bestScore) {
      bestScore = overlap;
      best = post;
    }
  }

  // Require at least 2 shared significant words — a single overlapping
  // word (e.g. both titles happen to say "guide") isn't a real match.
  return bestScore >= 2 ? best : null;
}
