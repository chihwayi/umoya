import { TeleconsultBridgeService } from '../teleconsult-bridge.service';

describe('TeleconsultBridgeService', () => {
  const service = new TeleconsultBridgeService();

  describe('buildSubjectiveNotes', () => {
    it('includes medications and allergies when present', () => {
      const notes = service.buildSubjectiveNotes({
        chiefComplaint: 'Cough',
        symptoms: ['cough'],
        currentMedications: 'TDF/3TC/DTG',
        allergies: 'Penicillin',
      });
      expect(notes).toContain('Medications: TDF/3TC/DTG');
      expect(notes).toContain('Allergies: Penicillin');
    });

    it('omits empty optional fields', () => {
      const notes = service.buildSubjectiveNotes({
        chiefComplaint: 'Fever',
        symptoms: ['fever'],
      });
      expect(notes).toBe('');
    });

    it('includes patient question', () => {
      const notes = service.buildSubjectiveNotes({
        chiefComplaint: 'Pain',
        symptoms: [],
        questionForDoctor: 'Is this serious?',
      });
      expect(notes).toContain('Patient question: Is this serious?');
    });
  });

  describe('linkPreConsultToEhr', () => {
    it('creates link and EHR draft visit, returns IDs', async () => {
      const calls: any[] = [];
      const fakeDb = {
        query: async (...args: any[]) => {
          calls.push(args);
          if (calls.length === 1) return [{ id: 'link1' }];
          if (calls.length === 2) return [{ id: 'visit1' }];
          return [];
        },
      };

      const result = await service.linkPreConsultToEhr(
        'tc1',
        'p1',
        { chiefComplaint: 'Cough', symptoms: ['cough', 'fever'] },
        fakeDb,
      );

      expect(result.linkId).toBe('link1');
      expect(result.ehrVisitDraftId).toBe('visit1');
      expect(calls).toHaveLength(3);
    });
  });
});
