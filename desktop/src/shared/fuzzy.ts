export interface FuzzyResult {
  score: number;
  /** Indices in the target string that matched, for highlighting. */
  positions: number[];
}

/**
 * Subsequence fuzzy match. Rewards consecutive characters, matches at word
 * boundaries and matches inside the file name over the directory part.
 * Returns null when not every query character can be found in order.
 */
export function fuzzyMatch(query: string, target: string): FuzzyResult | null {
  const q = query.replace(/\s+/g, "").toLowerCase();
  if (!q) return { score: 0, positions: [] };
  const t = target.toLowerCase();
  const nameStart = Math.max(t.lastIndexOf("/"), t.lastIndexOf("\\")) + 1;

  const positions: number[] = [];
  let score = 0;
  let ti = 0;
  let previous = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return null;
    positions.push(found);
    score += 1;
    if (found === previous + 1) score += 5;
    const before = found > 0 ? target[found - 1] : "";
    if (
      found === 0 ||
      /[\\/._\-\s]/.test(before) ||
      (/[a-z]/.test(before) && /[A-Z]/.test(target[found]))
    ) {
      score += 3;
    }
    if (found >= nameStart) score += 2;
    previous = found;
    ti = found + 1;
  }
  // Prefer shorter targets when scores tie.
  score -= target.length * 0.01;
  return { score, positions };
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  toText: (item: T) => string,
  limit = 200,
): { item: T; positions: number[] }[] {
  if (!query.trim()) return items.slice(0, limit).map((item) => ({ item, positions: [] }));
  const scored: { item: T; positions: number[]; score: number }[] = [];
  for (const item of items) {
    const result = fuzzyMatch(query, toText(item));
    if (result) scored.push({ item, positions: result.positions, score: result.score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
