import { findBestMatch } from '../link-matcher';
import type { RecentPost } from '../wordpress-client';

const posts: RecentPost[] = [
  {
    id: 1,
    title: 'Best GPUs for Budget Gaming Builds',
    link: 'https://example.com/best-budget-gpus',
  },
  { id: 2, title: 'How We Test Graphics Cards', link: 'https://example.com/benchmark-methodology' },
  {
    id: 3,
    title: 'Tariffs Are Reshaping Tech Supply Chains',
    link: 'https://example.com/tariff-coverage',
  },
];

describe('findBestMatch', () => {
  it('matches a topic that shares multiple significant words with a post title', () => {
    const match = findBestMatch('GPU buying guide budget gaming', posts);
    expect(match?.id).toBe(1);
  });

  it('returns null when nothing shares at least 2 significant words', () => {
    const match = findBestMatch('best budget smartphones 2026', posts);
    expect(match).toBeNull();
  });

  it('returns null for an empty topic', () => {
    expect(findBestMatch('', posts)).toBeNull();
  });

  it('returns null when there are no posts to match against', () => {
    expect(findBestMatch('GPU buying guide budget', [])).toBeNull();
  });

  it('ignores stopwords when scoring overlap', () => {
    // "the", "best", "guide", "for" are stopwords and don't count — but
    // "graphics" and "cards" are both significant and both genuinely
    // overlap with post 2's title, meeting the 2-word threshold.
    const match = findBestMatch('the best guide for the graphics cards', posts);
    expect(match?.id).toBe(2);
  });

  it('does not match on a single overlapping significant word', () => {
    const match = findBestMatch('graphics performance review', posts);
    expect(match).toBeNull();
  });

  it('picks the highest-overlap post when multiple share some words', () => {
    const match = findBestMatch('tariff supply chain tech coverage', posts);
    expect(match?.id).toBe(3);
  });
});
