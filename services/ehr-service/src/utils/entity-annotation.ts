export interface AnnotatedSpan {
  text: string;
  isEntity: boolean;
  entityId?: string;
  entityType?: string;
  entityValue?: string;
  normalizedValue?: Record<string, any>;
  confidence?: number;
  startIndex: number;
  endIndex: number;
}

export function annotateTextWithEntities(
  text: string,
  entities: Array<{
    id: string;
    entityType: string;
    entityValue: string;
    normalizedValue?: Record<string, any>;
    confidence?: number;
  }>,
): AnnotatedSpan[] {
  if (!text || !entities?.length) {
    return [{ text, isEntity: false, startIndex: 0, endIndex: text?.length ?? 0 }];
  }

  // Find all entity occurrences in the text (case-insensitive)
  const matches: Array<{ start: number; end: number; entity: (typeof entities)[0] }> = [];

  for (const entity of entities) {
    const searchTerm = entity.entityValue.toLowerCase();
    if (searchTerm.length < 2) continue; // skip very short matches
    const textLower = text.toLowerCase();
    let pos = 0;
    while (pos < textLower.length) {
      const idx = textLower.indexOf(searchTerm, pos);
      if (idx === -1) break;
      // Only match on word boundaries
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after =
        idx + searchTerm.length >= text.length || /\W/.test(text[idx + searchTerm.length]);
      if (before && after) {
        matches.push({ start: idx, end: idx + searchTerm.length, entity });
      }
      pos = idx + 1;
    }
  }

  // Sort by start position, prefer longer matches
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  // Remove overlaps (greedy: first/longest wins)
  const filtered: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // Build spans
  const spans: AnnotatedSpan[] = [];
  let cursor = 0;
  for (const m of filtered) {
    if (m.start > cursor) {
      spans.push({
        text: text.slice(cursor, m.start),
        isEntity: false,
        startIndex: cursor,
        endIndex: m.start,
      });
    }
    spans.push({
      text: text.slice(m.start, m.end),
      isEntity: true,
      entityId: m.entity.id,
      entityType: m.entity.entityType,
      entityValue: m.entity.entityValue,
      normalizedValue: m.entity.normalizedValue,
      confidence: m.entity.confidence,
      startIndex: m.start,
      endIndex: m.end,
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    spans.push({
      text: text.slice(cursor),
      isEntity: false,
      startIndex: cursor,
      endIndex: text.length,
    });
  }

  return spans;
}
