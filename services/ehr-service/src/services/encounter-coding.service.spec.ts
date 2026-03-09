import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EncounterCodingService } from './encounter-coding.service';

const mockQuery = jest.fn();
const mockTenantDb = { query: mockQuery, getRepository: jest.fn() } as unknown as DataSource;

const mockLlmService = { requestJsonCompletion: jest.fn() };
const mockIcd10Service = { searchIcd10Codes: jest.fn() };

let service: EncounterCodingService;

beforeEach(() => {
  mockQuery.mockReset();
  mockLlmService.requestJsonCompletion.mockReset();
  mockIcd10Service.searchIcd10Codes.mockReset();
  service = new EncounterCodingService(mockLlmService as any, mockIcd10Service as any);
});

function setupGatherClinicalText(text: string) {
  mockQuery.mockImplementation((sql: string, _params?: any[]) => {
    if (sql.includes('post_visit_draft_artifacts') && sql.includes('soap_note')) {
      return text
        ? [{ content: JSON.stringify({ subjective: text, objective: '', assessment: '', plan: '' }) }]
        : [];
    }
    if (sql.includes('post_visit_draft_artifacts') && sql.includes('visit_summary')) return [];
    if (sql.includes('post_visit_transcript_segments')) return [];
    if (sql.includes('appointments') && sql.includes('chief_complaint')) return [];
    if (sql.includes('INSERT INTO encounter_code_suggestions')) return [{ id: 'sug-1' }];
    if (sql.includes('SELECT id FROM encounter_code_suggestions')) return [{ id: 'sug-1' }];
    if (sql.includes('UPDATE encounter_code_suggestions')) return [];
    return [];
  });
}

describe('EncounterCodingService', () => {
  describe('suggestEncounterCodes - keyword fallback', () => {
    it('should extract hypertension and diabetes from clinical text when LLM fails', async () => {
      setupGatherClinicalText('Patient presents with hypertension and diabetes mellitus type 2');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('LLM unavailable'));
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'I10', description: 'Essential hypertension', rank: 90 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.icd10.length).toBeGreaterThanOrEqual(1);
      const descriptions = result.icd10.map(c => c.description.toLowerCase());
      expect(descriptions.some(d => d.includes('hypertension') || d.includes('diabetes'))).toBe(true);
    });

    it('should return empty ICD suggestions for empty clinical text', async () => {
      setupGatherClinicalText('');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('LLM unavailable'));

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.icd10).toEqual([]);
    });

    it('should detect asthma and copd keywords', async () => {
      setupGatherClinicalText('Patient has asthma and COPD, on inhalers');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('timeout'));
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'J45.909', description: 'Asthma', rank: 85 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.icd10.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect depression and anxiety keywords', async () => {
      setupGatherClinicalText('Major depressive disorder with ongoing anxiety');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'F32.9', description: 'Depression', rank: 80 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.icd10.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect procedure keywords like ECG', async () => {
      setupGatherClinicalText('Performed ECG and spirometry');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      const cptCodes = result.cpt.map(c => c.code);
      expect(cptCodes).toContain('93000');
      expect(cptCodes).toContain('94010');
    });
  });

  describe('suggestEncounterCodes - LLM path', () => {
    it('should use LLM results when available', async () => {
      setupGatherClinicalText('Patient with severe headache');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Migraine'],
          procedures: [],
          problems_addressed: 1,
          data_reviewed: [],
          risk_level: 'low',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'G43.909', description: 'Migraine, unspecified', rank: 88 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.icd10).toHaveLength(1);
      expect(result.icd10[0].code).toBe('G43.909');
      expect(result.source).toBe('ai');
    });

    it('should include E&M CPT when LLM returns context', async () => {
      setupGatherClinicalText('Full visit with multiple problems');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Hypertension', 'Diabetes'],
          procedures: [],
          problems_addressed: 2,
          data_reviewed: ['labs'],
          risk_level: 'moderate',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'I10', description: 'Hypertension', rank: 90 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      const codes = result.cpt.map(c => c.code);
      expect(codes).toContain('99214');
    });
  });

  describe('calculateEmLevel (via suggestEncounterCodes)', () => {
    it('should assign 99215 for high problem count / high risk', async () => {
      setupGatherClinicalText('complex case');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['A', 'B', 'C', 'D'],
          procedures: [],
          problems_addressed: 4,
          data_reviewed: ['labs', 'imaging', 'external_records'],
          risk_level: 'high',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.emLevel).toBe('99215');
      expect(result.emRationale).toContain('High complexity');
    });

    it('should assign 99212 for single straightforward problem', async () => {
      setupGatherClinicalText('simple visit');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Cold'],
          procedures: [],
          problems_addressed: 1,
          data_reviewed: [],
          risk_level: 'low',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.emLevel).toBe('99212');
    });

    it('should assign 99215 for counseling dominant with 40 min', async () => {
      setupGatherClinicalText('counseling session');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Depression'],
          procedures: [],
          problems_addressed: 1,
          data_reviewed: [],
          risk_level: 'low',
          counseling_dominant: true,
          total_time_minutes: 40,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.emLevel).toBe('99215');
      expect(result.emRationale).toContain('Time-based');
      expect(result.emRationale).toContain('40');
    });

    it('should assign 99214 for counseling dominant with 30 min', async () => {
      setupGatherClinicalText('counseling session');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Anxiety'],
          procedures: [],
          problems_addressed: 1,
          data_reviewed: [],
          risk_level: 'low',
          counseling_dominant: true,
          total_time_minutes: 30,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.emLevel).toBe('99214');
    });

    it('should assign 99213 for counseling dominant with 20 min', async () => {
      setupGatherClinicalText('brief counseling');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Insomnia'],
          procedures: [],
          problems_addressed: 1,
          data_reviewed: [],
          risk_level: 'low',
          counseling_dominant: true,
          total_time_minutes: 20,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.emLevel).toBe('99213');
    });

    it('should assign 99214 for moderate risk', async () => {
      setupGatherClinicalText('moderate visit');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Hypertension', 'Diabetes'],
          procedures: [],
          problems_addressed: 2,
          data_reviewed: [],
          risk_level: 'moderate',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.emLevel).toBe('99214');
    });
  });

  describe('suggestModifiers (via suggestEncounterCodes)', () => {
    it('should include modifier 25 when E&M + procedure code exist', async () => {
      setupGatherClinicalText('Injected steroid and assessed hypertension');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Hypertension'],
          procedures: ['Injection'],
          problems_addressed: 1,
          data_reviewed: ['labs'],
          risk_level: 'moderate',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'I10', description: 'Hypertension', rank: 90 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.modifiers).toContain('25');
    });

    it('should include modifier 59 when multiple procedure codes exist', async () => {
      setupGatherClinicalText('Injection and skin biopsy');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Lesion'],
          procedures: ['Injection', 'Skin biopsy'],
          problems_addressed: 1,
          data_reviewed: [],
          risk_level: 'low',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.modifiers).toContain('59');
    });

    it('should not include modifier 25 when no procedure codes', async () => {
      setupGatherClinicalText('simple visit only');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Cold'],
          procedures: [],
          problems_addressed: 1,
          data_reviewed: [],
          risk_level: 'low',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.modifiers).not.toContain('25');
    });
  });

  describe('reviewEncounterCodes', () => {
    it('should update accepted and rejected codes', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM encounter_code_suggestions')) return [{ id: 'sug-1' }];
        if (sql.includes('UPDATE encounter_code_suggestions')) return [];
        return [];
      });

      const result = await service.reviewEncounterCodes(
        mockTenantDb,
        'sug-1',
        { acceptedCodes: ['I10', '99214'], rejectedCodes: ['J45.909'] },
        'doc-1',
      );

      expect(result.id).toBe('sug-1');
      expect(result.acceptedCodes).toEqual(['I10', '99214']);
      expect(result.rejectedCodes).toEqual(['J45.909']);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE encounter_code_suggestions'),
        expect.any(Array),
      );
    });

    it('should throw NotFoundException for non-existent suggestion', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM encounter_code_suggestions')) return [];
        return [];
      });

      await expect(
        service.reviewEncounterCodes(
          mockTenantDb,
          'non-existent',
          { acceptedCodes: ['I10'], rejectedCodes: [] },
          'doc-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty accepted and rejected code arrays', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM encounter_code_suggestions')) return [{ id: 'sug-2' }];
        if (sql.includes('UPDATE')) return [];
        return [];
      });

      const result = await service.reviewEncounterCodes(
        mockTenantDb,
        'sug-2',
        { acceptedCodes: [], rejectedCodes: [] },
        'doc-1',
      );

      expect(result.acceptedCodes).toEqual([]);
      expect(result.rejectedCodes).toEqual([]);
    });
  });

  describe('confidence calculation', () => {
    it('should compute average confidence across ICD and CPT suggestions', async () => {
      setupGatherClinicalText('Hypertension visit with ECG');
      mockLlmService.requestJsonCompletion.mockResolvedValue({
        json: {
          diagnoses: ['Hypertension'],
          procedures: ['ECG'],
          problems_addressed: 1,
          data_reviewed: ['labs'],
          risk_level: 'moderate',
          counseling_dominant: false,
          total_time_minutes: null,
        },
      });
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'I10', description: 'Hypertension', rank: 90 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should still produce E&M code even with empty text (minimal complexity)', async () => {
      setupGatherClinicalText('');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.emLevel).toBe('99212');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('gatherClinicalText paths', () => {
    it('should gather text from appointment when no session', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('appointments') && sql.includes('chief_complaint')) {
          return [{ chief_complaint: 'Headache', clinical_notes: 'Severe migraine', diagnosis: null, assessment: null, plan: null }];
        }
        if (sql.includes('INSERT')) return [{ id: 'sug-1' }];
        return [];
      });
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([
        { code: 'G43.909', description: 'Headache', rank: 80 },
      ]);

      const result = await service.suggestEncounterCodes(mockTenantDb, null, 'appt-1', 'pat-1', 'doc-1');

      expect(result.icd10.length).toBeGreaterThanOrEqual(1);
    });

    it('should use transcript segments when SOAP note absent', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('soap_note')) return [];
        if (sql.includes('visit_summary')) return [];
        if (sql.includes('post_visit_transcript_segments')) {
          return [{ segment_text: 'patient has hypertension and diabetes' }];
        }
        if (sql.includes('chief_complaint')) return [];
        if (sql.includes('INSERT')) return [{ id: 'sug-1' }];
        return [];
      });
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('sug-1');
    });
  });

  describe('ICD10 resolution', () => {
    it('should use dash code when ICD10 search returns no results', async () => {
      setupGatherClinicalText('Patient has hyperlipidemia');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));
      mockIcd10Service.searchIcd10Codes.mockResolvedValue([]);

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      const dashCodes = result.icd10.filter(c => c.code === '—');
      expect(dashCodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle ICD10 search throwing errors gracefully', async () => {
      setupGatherClinicalText('Patient has anemia');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));
      mockIcd10Service.searchIcd10Codes.mockRejectedValue(new Error('db error'));

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', null, 'pat-1', 'doc-1');

      expect(result.icd10.length).toBeGreaterThanOrEqual(1);
      expect(result.icd10[0].confidence).toBeLessThan(0.5);
    });
  });

  describe('INSERT query', () => {
    it('should persist suggestion to database and return its ID', async () => {
      setupGatherClinicalText('simple visit');
      mockLlmService.requestJsonCompletion.mockRejectedValue(new Error('fail'));

      const result = await service.suggestEncounterCodes(mockTenantDb, 'sess-1', 'appt-1', 'pat-1', 'doc-1');

      expect(result.id).toBe('sug-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO encounter_code_suggestions'),
        expect.arrayContaining(['sess-1', 'appt-1', 'pat-1']),
      );
    });
  });
});
