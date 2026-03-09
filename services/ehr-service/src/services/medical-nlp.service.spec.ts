import { DataSource } from 'typeorm';
import { MedicalNlpService, ParsedAllergy } from './medical-nlp.service';

describe('MedicalNlpService', () => {
  let service: MedicalNlpService;

  beforeEach(() => {
    service = new MedicalNlpService();
  });

  describe('extractAllergiesFromText', () => {
    it('should parse "penicillin - severe anaphylaxis, sulfa - mild rash" into 2 allergies', () => {
      const result = service.extractAllergiesFromText(
        'penicillin - severe anaphylaxis, sulfa - mild rash',
      );
      expect(result).toHaveLength(2);

      const pen = result.find((a) => a.allergen.toLowerCase().includes('penicillin'));
      expect(pen).toBeDefined();
      expect(pen!.severity).toBe('severe');
      expect(pen!.reaction?.toLowerCase()).toContain('anaphylaxis');

      const sulfa = result.find((a) => a.allergen.toLowerCase().includes('sulfonamide') || a.allergen.toLowerCase().includes('sulfa'));
      expect(sulfa).toBeDefined();
      expect(sulfa!.severity).toBe('mild');
    });

    it('should return empty array for "NKDA"', () => {
      expect(service.extractAllergiesFromText('NKDA')).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(service.extractAllergiesFromText('')).toEqual([]);
    });

    it('should return empty array for null-ish inputs', () => {
      expect(service.extractAllergiesFromText(null as any)).toEqual([]);
      expect(service.extractAllergiesFromText(undefined as any)).toEqual([]);
    });

    it('should return empty for "no known allergies" and variants', () => {
      expect(service.extractAllergiesFromText('no known allergies')).toEqual([]);
      expect(service.extractAllergiesFromText('NKA')).toEqual([]);
      expect(service.extractAllergiesFromText('none')).toEqual([]);
      expect(service.extractAllergiesFromText('nil')).toEqual([]);
    });

    it('should parse "shellfish (hives), latex" into 2 allergies with shellfish having reaction hives', () => {
      const result = service.extractAllergiesFromText('shellfish (hives), latex');
      expect(result).toHaveLength(2);

      const shellfish = result.find((a) => a.allergen.toLowerCase().includes('shellfish'));
      expect(shellfish).toBeDefined();
      expect(shellfish!.reaction?.toLowerCase()).toContain('urticaria');

      const latex = result.find((a) => a.allergen.toLowerCase().includes('latex'));
      expect(latex).toBeDefined();
    });

    it('should parse "severe rash to amoxicillin" with severity=severe and amoxicillin allergen', () => {
      const result = service.extractAllergiesFromText('severe rash to amoxicillin');
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('severe');
      expect(result[0].allergen.toLowerCase()).toContain('amoxicillin');
    });

    it('should parse "peanut, tree nut, egg, milk" into 4 food allergies', () => {
      const result = service.extractAllergiesFromText('peanut, tree nut, egg, milk');
      expect(result).toHaveLength(4);
      for (const allergy of result) {
        expect(allergy.category).toBe('food');
      }
    });

    it('should populate SNOMED codes for known allergens', () => {
      const result = service.extractAllergiesFromText('penicillin');
      expect(result).toHaveLength(1);
      expect(result[0].allergenSnomedCode).toBe('764146007');
      expect(result[0].allergenSnomedTerm).toBe('Penicillin');
    });

    it('should populate SNOMED codes for known reactions', () => {
      const result = service.extractAllergiesFromText('penicillin - severe anaphylaxis');
      expect(result).toHaveLength(1);
      expect(result[0].reactionSnomedCode).toBe('39579001');
      expect(result[0].reactionSnomedTerm).toBe('Anaphylaxis');
    });

    it('should assign confidence 0.9 for known allergens', () => {
      const result = service.extractAllergiesFromText('penicillin');
      expect(result[0].confidence).toBe(0.9);
    });

    it('should assign low confidence for unknown allergens', () => {
      const result = service.extractAllergiesFromText('xyzunknowndrug123');
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBeLessThanOrEqual(0.5);
    });

    it('should deduplicate identical allergens in a single text', () => {
      const result = service.extractAllergiesFromText('penicillin, penicillin');
      expect(result).toHaveLength(1);
    });

    it('should handle semicolon-separated input', () => {
      const result = service.extractAllergiesFromText('aspirin; ibuprofen');
      expect(result).toHaveLength(2);
    });
  });

  describe('reconcilePatientAllergies', () => {
    let mockQuery: jest.Mock;
    let mockTenantDb: DataSource;

    beforeEach(() => {
      mockQuery = jest.fn();
      mockTenantDb = { query: mockQuery } as unknown as DataSource;
    });

    it('should INSERT new allergies from patient text', async () => {
      mockQuery
        .mockResolvedValueOnce([{ allergies: 'penicillin - severe anaphylaxis' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      const result = await service.reconcilePatientAllergies(mockTenantDb, 'patient-1');

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.parsed).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledTimes(3);

      const insertCall = mockQuery.mock.calls[2];
      expect(insertCall[0]).toContain('INSERT INTO allergies');
    });

    it('should skip allergies that already exist', async () => {
      mockQuery
        .mockResolvedValueOnce([{ allergies: 'penicillin, aspirin' }])
        .mockResolvedValueOnce([{ allergen: 'penicillin' }])
        .mockResolvedValueOnce(undefined);

      const result = await service.reconcilePatientAllergies(mockTenantDb, 'patient-2');

      expect(result.skipped).toBe(1);
      expect(result.added).toBe(1);
    });

    it('should return zeros when patient has no allergies text', async () => {
      mockQuery.mockResolvedValueOnce([{ allergies: '' }]);

      const result = await service.reconcilePatientAllergies(mockTenantDb, 'patient-3');
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.parsed).toEqual([]);
    });

    it('should return zeros when patient has NKDA', async () => {
      mockQuery.mockResolvedValueOnce([{ allergies: 'NKDA' }]);

      const result = await service.reconcilePatientAllergies(mockTenantDb, 'patient-4');
      expect(result.added).toBe(0);
      expect(result.parsed).toEqual([]);
    });

    it('should return zeros when patient row is missing', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await service.reconcilePatientAllergies(mockTenantDb, 'patient-5');
      expect(result.added).toBe(0);
    });
  });

  describe('batchReconcileAllPatients', () => {
    let mockQuery: jest.Mock;
    let mockTenantDb: DataSource;

    beforeEach(() => {
      mockQuery = jest.fn();
      mockTenantDb = { query: mockQuery } as unknown as DataSource;
    });

    it('should process multiple patients', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }])
        // p1 reconciliation
        .mockResolvedValueOnce([{ allergies: 'aspirin' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        // p2 reconciliation
        .mockResolvedValueOnce([{ allergies: 'penicillin, sulfa' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await service.batchReconcileAllPatients(mockTenantDb);

      expect(result.patientsProcessed).toBe(2);
      expect(result.totalAdded).toBeGreaterThanOrEqual(2);
    });

    it('should return zeros when no patients found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await service.batchReconcileAllPatients(mockTenantDb);
      expect(result.patientsProcessed).toBe(0);
      expect(result.totalAdded).toBe(0);
    });
  });
});
