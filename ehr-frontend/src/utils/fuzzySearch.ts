/**
 * Fuzzy matching utility for command palette search
 * Scores matches based on character sequence alignment
 */

export interface FuzzyMatch {
  item: any;
  score: number;
  positions: number[]; // Character positions of matches in the search target
}

/**
 * Simple fuzzy matcher: each character of the query must appear in order in the target.
 * Returns a score (higher is better) and the positions of matched characters.
 * Score is based on:
 * - Character match frequency (more matches = higher score)
 * - Position adjacency (consecutive positions get a bonus)
 * - Early matches (matches at the start get a bonus)
 */
export function fuzzyMatch(query: string, target: string): { score: number; positions: number[] } | null {
  if (!query || !target) {
    return !query ? { score: 0, positions: [] } : null;
  }

  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const positions: number[] = [];
  let qIdx = 0;

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      positions.push(tIdx);
      qIdx++;
    }
  }

  if (qIdx !== q.length) {
    return null; // Not all query characters were found in order
  }

  // Score calculation: character count + bonuses for position patterns
  let score = q.length;

  // Bonus for matches at the start
  if (positions[0] === 0) {
    score += 3;
  } else if (positions[0] < 3) {
    score += 1;
  }

  // Bonus for consecutive positions (word boundaries)
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === positions[i - 1] + 1) {
      score += 0.5;
    }
  }

  // Bonus for tightness: positions clustered together = better match
  if (positions.length > 1) {
    const span = positions[positions.length - 1] - positions[0];
    const tightness = positions.length / (span + 1);
    score += tightness * 2;
  }

  return { score, positions };
}

/**
 * Filter and rank a list of items by fuzzy matching against a query
 */
export function fuzzyFilter<T extends Record<string, any>>(
  items: T[],
  query: string,
  searchKeys: (string | ((item: T) => string))[]
): FuzzyMatch[] {
  if (!query.trim()) {
    return items.map((item) => ({ item, score: 0, positions: [] }));
  }

  const matches: FuzzyMatch[] = [];

  for (const item of items) {
    let bestScore = -1;
    let bestPositions: number[] = [];

    for (const key of searchKeys) {
      const text = typeof key === 'function' ? key(item) : item[key];
      if (!text) continue;

      const result = fuzzyMatch(query, String(text));
      if (result && result.score > bestScore) {
        bestScore = result.score;
        bestPositions = result.positions;
      }
    }

    if (bestScore > -1) {
      matches.push({ item, score: bestScore, positions: bestPositions });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}
