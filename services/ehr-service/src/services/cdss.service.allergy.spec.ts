import { DataSource } from 'typeorm';
import { CdssService } from './cdss.service';
import { CROSS_REACTIVITY_MAP, DRUG_CLASS_MEMBERS } from '../config/allergy-cross-reactivity';

const mockQuery = jest.fn();
const mockFindOne = jest.fn();
const mockGetRepository = jest.fn().mockReturnValue({ findOne: mockFindOne });
const mockTenantDb = { query: mockQuery, getRepository: mockGetRepository } as unknown as DataSource;

let service: CdssService;

beforeEach(() => {
  mockQuery.mockReset();
  mockFindOne.mockReset();
  mockGetRepository.mockReturnValue({ findOne: mockFindOne });
  service = new CdssService();
});

function setupAllergies(structuredAllergens: string[], legacyText = '') {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('FROM allergies')) {
      return structuredAllergens.map(a => ({
        id: `allergy-${a}`,
        allergen: a,
        severity: 'moderate',
        reaction: 'rash',
        allergy_type: 'drug',
        status: 'active',
      }));
    }
    return [];
  });
  mockFindOne.mockResolvedValue({
    id: 'pat-1',
    allergies: legacyText,
  });
}

describe('CdssService - getAllergyWarnings', () => {
  describe('direct allergy match', () => {
    it('should return direct allergy for ibuprofen when patient allergic to ibuprofen', async () => {
      setupAllergies(['ibuprofen']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['Ibuprofen'], mockTenantDb);

      expect(warnings.length).toBeGreaterThanOrEqual(1);
      const direct = warnings.find(w => !w.crossReactivity);
      expect(direct).toBeDefined();
      expect(direct!.allergen).toBe('ibuprofen');
      expect(direct!.severity).toBe('high');
    });

    it('should return direct allergy for penicillin when patient allergic to penicillin', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['Penicillin'], mockTenantDb);

      const direct = warnings.find(w => !w.crossReactivity);
      expect(direct).toBeDefined();
      expect(direct!.allergen).toBe('penicillin');
    });

    it('should match via substring (allergen contains medication)', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['penicillin V'], mockTenantDb);

      expect(warnings.some(w => w.allergen === 'penicillin')).toBe(true);
    });

    it('should match via substring (medication contains allergen)', async () => {
      setupAllergies(['aspirin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['aspirin'], mockTenantDb);

      expect(warnings.some(w => w.allergen === 'aspirin')).toBe(true);
    });

    it('should include reaction details in direct match message', async () => {
      setupAllergies(['amoxicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['amoxicillin'], mockTenantDb);

      const direct = warnings.find(w => !w.crossReactivity && w.allergen === 'amoxicillin');
      expect(direct).toBeDefined();
      expect(direct!.message).toContain('Direct allergy match');
    });
  });

  describe('penicillin cross-reactivity', () => {
    it('should warn about amoxicillin when patient allergic to penicillin', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['amoxicillin'], mockTenantDb);

      expect(warnings.length).toBeGreaterThanOrEqual(1);
      const crossWarning = warnings.find(w => w.crossReactivity);
      expect(crossWarning).toBeDefined();
      expect(crossWarning!.allergen).toBe('penicillin');
      expect(crossWarning!.medication).toBe('amoxicillin');
    });

    it('should warn about ceftriaxone (cephalosporin) when allergic to penicillin', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['ceftriaxone'], mockTenantDb);

      const crossWarning = warnings.find(w => w.crossReactivity);
      expect(crossWarning).toBeDefined();
      expect(crossWarning!.allergen).toBe('penicillin');
    });

    it('should set penicillin cross-reactivity risk as moderate', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['cephalexin'], mockTenantDb);

      const crossWarning = warnings.find(w => w.crossReactivity && w.allergen === 'penicillin');
      expect(crossWarning).toBeDefined();
      expect(crossWarning!.severity).toBe('moderate');
    });

    it('should not warn for metformin when allergic to penicillin', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['metformin'], mockTenantDb);

      expect(warnings).toEqual([]);
    });
  });

  describe('NSAID / aspirin cross-reactivity', () => {
    it('should warn about ibuprofen when patient allergic to aspirin', async () => {
      setupAllergies(['aspirin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['ibuprofen'], mockTenantDb);

      expect(warnings.length).toBeGreaterThanOrEqual(1);
      const crossWarning = warnings.find(w => w.crossReactivity);
      expect(crossWarning).toBeDefined();
      expect(crossWarning!.allergen).toBe('aspirin');
      expect(crossWarning!.medication).toBe('ibuprofen');
    });

    it('should set NSAID/aspirin cross-reactivity as high risk', async () => {
      setupAllergies(['aspirin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['naproxen'], mockTenantDb);

      const crossWarning = warnings.find(w => w.crossReactivity);
      expect(crossWarning).toBeDefined();
      expect(crossWarning!.severity).toBe('high');
    });

    it('should warn about aspirin when patient allergic to ibuprofen (NSAID class)', async () => {
      setupAllergies(['ibuprofen']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['aspirin'], mockTenantDb);

      const crossOrDirect = warnings.find(w => w.medication === 'aspirin');
      expect(crossOrDirect).toBeDefined();
    });

    it('should warn about diclofenac when allergic to naproxen (same NSAID class)', async () => {
      setupAllergies(['naproxen']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['diclofenac'], mockTenantDb);

      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('no warnings expected', () => {
    it('should return no warnings for penicillin allergy + metformin', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['metformin'], mockTenantDb);

      expect(warnings).toEqual([]);
    });

    it('should return no warnings for aspirin allergy + atorvastatin', async () => {
      setupAllergies(['aspirin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', ['atorvastatin'], mockTenantDb);

      expect(warnings).toEqual([]);
    });

    it('should return no warnings when patient has no allergies', async () => {
      setupAllergies([]);
      mockFindOne.mockResolvedValue({ id: 'pat-1', allergies: '' });

      const { warnings } = await service.getAllergyWarnings('pat-1', ['amoxicillin'], mockTenantDb);

      expect(warnings).toEqual([]);
    });

    it('should return no warnings for empty medication list', async () => {
      setupAllergies(['penicillin']);

      const { warnings } = await service.getAllergyWarnings('pat-1', [], mockTenantDb);

      expect(warnings).toEqual([]);
    });
  });

  describe('legacy allergy text', () => {
    it('should detect allergy from legacy text field', async () => {
      setupAllergies([], 'penicillin, sulfa');

      const { warnings } = await service.getAllergyWarnings('pat-1', ['amoxicillin'], mockTenantDb);

      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse comma-separated legacy allergies', async () => {
      setupAllergies([], 'penicillin, aspirin, latex');

      const { warnings } = await service.getAllergyWarnings('pat-1', ['ibuprofen'], mockTenantDb);

      expect(warnings.some(w => w.allergen === 'aspirin')).toBe(true);
    });

    it('should handle semicolon-separated legacy text', async () => {
      setupAllergies([], 'penicillin; morphine');

      const { warnings } = await service.getAllergyWarnings('pat-1', ['codeine'], mockTenantDb);

      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('structuredAllergies return', () => {
    it('should return structured allergy rows alongside warnings', async () => {
      setupAllergies(['penicillin', 'aspirin']);

      const { structuredAllergies } = await service.getAllergyWarnings('pat-1', ['metformin'], mockTenantDb);

      expect(structuredAllergies).toHaveLength(2);
      expect(structuredAllergies[0].allergen).toBe('penicillin');
      expect(structuredAllergies[1].allergen).toBe('aspirin');
    });
  });

  describe('multiple medications', () => {
    it('should check all medications against all allergies', async () => {
      setupAllergies(['penicillin', 'aspirin']);

      const { warnings } = await service.getAllergyWarnings(
        'pat-1',
        ['amoxicillin', 'ibuprofen', 'metformin'],
        mockTenantDb,
      );

      const amoxWarning = warnings.find(w => w.medication === 'amoxicillin');
      const ibuWarning = warnings.find(w => w.medication === 'ibuprofen');
      const metWarning = warnings.find(w => w.medication === 'metformin');

      expect(amoxWarning).toBeDefined();
      expect(ibuWarning).toBeDefined();
      expect(metWarning).toBeUndefined();
    });
  });

  describe('cross-reactivity config integrity', () => {
    it('penicillin entry should include amoxicillin in relatedClasses', () => {
      expect(CROSS_REACTIVITY_MAP.penicillin.relatedClasses).toContain('amoxicillin');
    });

    it('aspirin entry should include nsaid in relatedClasses', () => {
      expect(CROSS_REACTIVITY_MAP.aspirin.relatedClasses).toContain('nsaid');
    });

    it('nsaid entry should include aspirin in relatedClasses', () => {
      expect(CROSS_REACTIVITY_MAP.nsaid.relatedClasses).toContain('aspirin');
    });

    it('DRUG_CLASS_MEMBERS penicillin should include amoxicillin', () => {
      expect(DRUG_CLASS_MEMBERS.penicillin).toContain('amoxicillin');
    });

    it('DRUG_CLASS_MEMBERS nsaid should include ibuprofen', () => {
      expect(DRUG_CLASS_MEMBERS.nsaid).toContain('ibuprofen');
    });

    it('DRUG_CLASS_MEMBERS nsaid should include naproxen', () => {
      expect(DRUG_CLASS_MEMBERS.nsaid).toContain('naproxen');
    });
  });
});
