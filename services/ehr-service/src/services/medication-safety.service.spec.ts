import { DataSource } from 'typeorm';
import { MedicationSafetyService } from './medication-safety.service';

const mockQuery = jest.fn();
const mockTenantDb = { query: mockQuery, getRepository: jest.fn() } as unknown as DataSource;

const mockPatientService = { getPatientContext: jest.fn() };

let service: MedicationSafetyService;

beforeEach(() => {
  mockQuery.mockReset();
  mockPatientService.getPatientContext.mockReset();
  service = new MedicationSafetyService(mockPatientService as any);
});

function pregnantContext(riskCategory = 'high') {
  return {
    modules: {
      maternity: {
        latestEnrollment: {
          enrollment_status: 'active',
          expected_delivery_date: '2026-08-01',
          lmp_date: '2025-11-01',
          risk_category: riskCategory,
        },
      },
    },
  };
}

function nonPregnantContext() {
  return { modules: {} };
}

function setupLabQueries(opts: { egfrValue?: string | null; altValue?: string | null; bilirubinValue?: string | null }) {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.toLowerCase().includes('egfr')) {
      if (opts.egfrValue === null || opts.egfrValue === undefined) return [];
      return [{ result_value: opts.egfrValue }];
    }
    if (sql.toLowerCase().includes('alt') || sql.toLowerCase().includes('ast') || sql.toLowerCase().includes('bilirubin')) {
      const rows: any[] = [];
      if (opts.altValue) rows.push({ test_name: 'ALT', result_value: opts.altValue });
      if (opts.bilirubinValue) rows.push({ test_name: 'Bilirubin Total', result_value: opts.bilirubinValue });
      return rows;
    }
    return [];
  });
}

describe('MedicationSafetyService', () => {
  describe('pregnancy alerts', () => {
    it('should flag isotretinoin as major teratogen for pregnant patient', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Isotretinoin' },
      ]);

      expect(result.pregnancy.isPregnant).toBe(true);
      expect(result.pregnancy.alerts.length).toBeGreaterThanOrEqual(1);
      expect(result.pregnancy.alerts[0].severity).toBe('major');
      expect(result.pregnancy.alerts[0].medication).toBe('isotretinoin');
    });

    it('should flag warfarin as major teratogen', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Warfarin' },
      ]);

      expect(result.pregnancy.alerts.some(a => a.medication === 'warfarin' && a.severity === 'major')).toBe(true);
    });

    it('should flag valproate as major teratogen', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Valproic acid' },
      ]);

      expect(result.pregnancy.alerts.some(a => a.medication === 'valpro' && a.severity === 'major')).toBe(true);
    });

    it('should flag lisinopril as moderate risk in pregnancy', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Lisinopril' },
      ]);

      expect(result.pregnancy.alerts.some(a => a.medication === 'lisinopril' && a.severity === 'moderate')).toBe(true);
    });

    it('should flag losartan as moderate risk in pregnancy', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Losartan' },
      ]);

      expect(result.pregnancy.alerts.some(a => a.medication === 'losartan')).toBe(true);
    });

    it('should return no pregnancy alerts for non-pregnant patient', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Isotretinoin' },
      ]);

      expect(result.pregnancy.isPregnant).toBe(false);
      expect(result.pregnancy.alerts).toEqual([]);
    });

    it('should detect pregnancy via expected_delivery_date even without active enrollment', async () => {
      mockPatientService.getPatientContext.mockResolvedValue({
        modules: {
          maternity: {
            latestEnrollment: {
              enrollment_status: 'pending',
              expected_delivery_date: '2026-09-01',
              lmp_date: null,
              risk_category: null,
            },
          },
        },
      });
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Warfarin' },
      ]);

      expect(result.pregnancy.isPregnant).toBe(true);
    });
  });

  describe('renal alerts', () => {
    it('should flag metformin as major when eGFR < 30', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '25' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Metformin' },
      ]);

      expect(result.renal.egfr).toBe(25);
      expect(result.renal.alerts.some(a => a.medication === 'metformin' && a.severity === 'major')).toBe(true);
    });

    it('should flag metformin as moderate when eGFR between 30-44', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '40' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Metformin' },
      ]);

      expect(result.renal.alerts.some(a => a.medication === 'metformin' && a.severity === 'moderate')).toBe(true);
    });

    it('should flag nitrofurantoin when eGFR < 30', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '20' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Nitrofurantoin' },
      ]);

      expect(result.renal.alerts.some(a => a.medication === 'nitrofurantoin' && a.severity === 'major')).toBe(true);
    });

    it('should flag gabapentin when eGFR < 60', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '55' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Gabapentin' },
      ]);

      expect(result.renal.alerts.some(a => a.medication === 'gabapentin' && a.severity === 'moderate')).toBe(true);
    });

    it('should flag rivaroxaban when eGFR < 50', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '45' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Rivaroxaban' },
      ]);

      expect(result.renal.alerts.some(a => a.medication === 'rivaroxaban' && a.severity === 'major')).toBe(true);
    });

    it('should return no renal alerts when eGFR is normal', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '90' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Metformin' },
        { genericName: 'Gabapentin' },
      ]);

      expect(result.renal.egfr).toBe(90);
      expect(result.renal.alerts).toEqual([]);
    });

    it('should return null eGFR and no alerts when no lab results exist', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Metformin' },
      ]);

      expect(result.renal.egfr).toBeNull();
      expect(result.renal.alerts).toEqual([]);
    });
  });

  describe('hepatic alerts', () => {
    it('should detect hepatic impairment when ALT > 80', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '90', altValue: '120' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Paracetamol' },
      ]);

      expect(result.hepatic.suspectedImpairment).toBe(true);
      expect(result.hepatic.alerts.some(a => a.medication === 'paracetamol' && a.severity === 'major')).toBe(true);
    });

    it('should detect hepatic impairment when bilirubin > 2', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '90', bilirubinValue: '3.5' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Atorvastatin' },
      ]);

      expect(result.hepatic.suspectedImpairment).toBe(true);
      expect(result.hepatic.alerts.some(a => a.medication === 'atorvastatin' && a.severity === 'moderate')).toBe(true);
    });

    it('should not flag hepatic impairment with normal labs', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '90', altValue: '30' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Paracetamol' },
      ]);

      expect(result.hepatic.suspectedImpairment).toBe(false);
      expect(result.hepatic.alerts).toEqual([]);
    });
  });

  describe('normal patient with safe drugs', () => {
    it('should return no alerts for healthy patient on safe medication', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '95', altValue: '25' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Omeprazole' },
      ]);

      expect(result.pregnancy.alerts).toEqual([]);
      expect(result.renal.alerts).toEqual([]);
      expect(result.hepatic.alerts).toEqual([]);
    });

    it('should handle empty medication list', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(nonPregnantContext());
      setupLabQueries({ egfrValue: '80' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', []);

      expect(result.pregnancy.alerts).toEqual([]);
      expect(result.renal.alerts).toEqual([]);
      expect(result.hepatic.alerts).toEqual([]);
    });
  });

  describe('medication name normalization', () => {
    it('should match using genericName field', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'ISOTRETINOIN' },
      ]);

      expect(result.pregnancy.alerts.length).toBeGreaterThanOrEqual(1);
    });

    it('should match using name field when genericName is absent', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { name: 'Warfarin Sodium' },
      ]);

      expect(result.pregnancy.alerts.some(a => a.medication === 'warfarin')).toBe(true);
    });

    it('should match using medication_name_snomed field', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { medication_name_snomed: 'Warfarin' },
      ]);

      expect(result.pregnancy.alerts.some(a => a.medication === 'warfarin')).toBe(true);
    });
  });

  describe('combined scenarios', () => {
    it('should flag both pregnancy and renal alerts simultaneously', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext());
      setupLabQueries({ egfrValue: '25' });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', [
        { genericName: 'Warfarin' },
        { genericName: 'Metformin' },
      ]);

      expect(result.pregnancy.alerts.some(a => a.medication === 'warfarin')).toBe(true);
      expect(result.renal.alerts.some(a => a.medication === 'metformin')).toBe(true);
    });

    it('should include risk category from maternity context', async () => {
      mockPatientService.getPatientContext.mockResolvedValue(pregnantContext('high'));
      setupLabQueries({ egfrValue: null });

      const result = await service.assessMedicationSafety(mockTenantDb, 'pat-1', []);

      expect(result.pregnancy.riskCategory).toBe('high');
    });
  });
});
