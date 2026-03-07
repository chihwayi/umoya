import { annotateTextWithEntities, AnnotatedSpan } from './entity-annotation';

describe('entity-annotation', () => {
  describe('annotateTextWithEntities', () => {
    it('returns single non-entity span when no text or no entities', () => {
      expect(annotateTextWithEntities('', [])).toEqual([
        { text: '', isEntity: false, startIndex: 0, endIndex: 0 },
      ]);
      expect(annotateTextWithEntities('Hello', [])).toEqual([
        { text: 'Hello', isEntity: false, startIndex: 0, endIndex: 5 },
      ]);
      const entities = [{ id: '1', entityType: 'symptom', entityValue: 'pain' }];
      expect(annotateTextWithEntities('', entities)).toEqual([
        { text: '', isEntity: false, startIndex: 0, endIndex: 0 },
      ]);
    });

    it('produces 5 spans for "Patient presents with chest pain and requests ECG." with chest pain and ECG entities', () => {
      const text = 'Patient presents with chest pain and requests ECG.';
      const entities = [
        { id: '1', entityType: 'symptom', entityValue: 'chest pain' },
        { id: '2', entityType: 'procedure', entityValue: 'ECG' },
      ];
      const spans = annotateTextWithEntities(text, entities);
      expect(spans).toHaveLength(5);

      expect(spans[0]).toMatchObject({
        text: 'Patient presents with ',
        isEntity: false,
        startIndex: 0,
        endIndex: 22,
      });
      expect(spans[1]).toMatchObject({
        text: 'chest pain',
        isEntity: true,
        entityId: '1',
        entityType: 'symptom',
        entityValue: 'chest pain',
        startIndex: 22,
        endIndex: 32,
      });
      expect(spans[2]).toMatchObject({
        text: ' and requests ',
        isEntity: false,
        startIndex: 32,
        endIndex: 46,
      });
      expect(spans[3]).toMatchObject({
        text: 'ECG',
        isEntity: true,
        entityId: '2',
        entityType: 'procedure',
        entityValue: 'ECG',
        startIndex: 46,
        endIndex: 49,
      });
      expect(spans[4]).toMatchObject({
        text: '.',
        isEntity: false,
        startIndex: 49,
        endIndex: 50,
      });
    });

    it('skips entity matches shorter than 2 chars', () => {
      const text = 'Patient has a cold';
      const entities = [{ id: '1', entityType: 'symptom', entityValue: 'a' }];
      const spans = annotateTextWithEntities(text, entities);
      expect(spans).toHaveLength(1);
      expect(spans[0].isEntity).toBe(false);
      expect(spans[0].text).toBe(text);
    });

    it('matches on word boundaries only', () => {
      const text = 'ECG ordered; ECG machine';
      const entities = [{ id: '1', entityType: 'procedure', entityValue: 'ECG' }];
      const spans = annotateTextWithEntities(text, entities);
      const entitySpans = spans.filter((s: AnnotatedSpan) => s.isEntity);
      expect(entitySpans.length).toBe(2);
      expect(entitySpans.every((s) => s.text === 'ECG')).toBe(true);
    });
  });
});
