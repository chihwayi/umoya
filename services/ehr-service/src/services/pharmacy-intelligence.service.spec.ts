import { MedicationReconciliationAiReview } from '../entities/medication-reconciliation-ai-review.entity';
import { AntimicrobialStewardship } from '../entities/antimicrobial-stewardship.entity';
import { PharmacyDispensingAnomaly } from '../entities/pharmacy-dispensing-anomaly.entity';
import { PharmacyInventoryForecast } from '../entities/pharmacy-inventory-forecast.entity';
import { PharmacySubstitutionRecommendation } from '../entities/pharmacy-substitution-recommendation.entity';
import { PharmacyIntelligenceService } from './pharmacy-intelligence.service';

describe('PharmacyIntelligenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('produces reconciliation review, substitution recommendations, and counseling material from mismatched medication inputs', async () => {
    const medicationHistoryService = {
      getMedications: jest.fn().mockResolvedValue([
        {
          id: 'med-1',
          medicationName: 'Lipitor',
          genericName: 'atorvastatin',
          dosage: '20',
          frequency: 'daily',
          adherencePercentage: 72,
          reconciliationStatus: 'verified',
          prescriptionId: 'rx-1',
          medicationType: 'current',
          status: 'active',
        },
        {
          id: 'med-2',
          medicationName: 'Augmentin',
          genericName: 'amoxicillin clavulanate',
          dosage: '625',
          frequency: 'bd',
          adherencePercentage: 95,
          reconciliationStatus: 'needs_review',
          prescriptionId: 'rx-2',
          medicationType: 'current',
          status: 'active',
        },
      ]),
    };
    const medicationSafetyService = {
      assessMedicationSafety: jest.fn().mockResolvedValue({
        pregnancy: { isPregnant: false, riskCategory: null, alerts: [] },
        renal: { egfr: 48, alerts: [{ medication: 'atorvastatin', severity: 'moderate' }] },
        hepatic: { suspectedImpairment: false, rationale: null, alerts: [] },
      }),
    };
    const formularyOptimizationService = {
      optimizeOnPrescription: jest.fn()
        .mockResolvedValueOnce({
          genericAlternative: 'atorvastatin',
          brandedCost: 25,
          genericCost: 7,
          savingAmount: 18,
          medicalAidCoverage: true,
          medicalAidTier: 1,
          evidenceEquivalence: 'A',
          aiRecommendation: 'generic',
          reason: 'Generic equivalent available',
          accepted: null,
        })
        .mockResolvedValueOnce({
          genericAlternative: 'amoxicillin clavulanate',
          brandedCost: 30,
          genericCost: 14,
          savingAmount: 16,
          medicalAidCoverage: true,
          medicalAidTier: 2,
          evidenceEquivalence: 'A',
          aiRecommendation: 'generic',
          reason: 'Lower-cost generic available',
          accepted: null,
        }),
    };
    const multilingualEducationService = {
      generate: jest.fn().mockResolvedValue({
        id: 'edu-1',
        patientId: 'patient-1',
        topic: 'Medication counseling',
      }),
    };

    const reviewRows: any[] = [];
    const substitutionRows: any[] = [];
    const reviewRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: 'review-1', ...value };
        reviewRows.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ id }) => reviewRows.find((row) => row.id === id) ?? null),
    };
    const substitutionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const rows = value.map((item: any, index: number) => ({ id: `sub-${index + 1}`, ...item }));
        substitutionRows.push(...rows);
        return rows;
      }),
      find: jest.fn(async ({ where }: any) =>
        substitutionRows.filter((row) => row.reviewId === where.reviewId),
      ),
    };

    const tenantDb = {
      getRepository: jest.fn((entity: any) => {
        if (entity === MedicationReconciliationAiReview) {
          return reviewRepo;
        }
        if (entity === PharmacySubstitutionRecommendation) {
          return substitutionRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new PharmacyIntelligenceService(
      medicationHistoryService as any,
      medicationSafetyService as any,
      formularyOptimizationService as any,
      multilingualEducationService as any,
      { checkHighRiskMedications: jest.fn() } as any,
    );

    const result = await service.generateMedicationReview(
      'kids-clinic',
      tenantDb,
      {
        patientId: 'patient-1',
        encounterId: 'enc-1',
        language: 'en',
        reportedMedications: [
          { name: 'Lipitor', genericName: 'atorvastatin', dosage: '20', frequency: 'daily', source: 'patient_report' },
          { name: 'Cotrimoxazole', genericName: 'co-trimoxazole', dosage: '960', frequency: 'daily', source: 'patient_report' },
        ],
      },
      'user-1',
    );

    expect(reviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        discrepancySummary: expect.arrayContaining([
          expect.objectContaining({ type: 'missing_from_reported', medicationName: 'Augmentin' }),
          expect.objectContaining({ type: 'reported_not_on_record', medicationName: 'Cotrimoxazole' }),
        ]),
        adherenceConcerns: expect.arrayContaining([
          expect.objectContaining({ medicationName: 'Lipitor', adherencePercentage: 72 }),
        ]),
        recommendedActions: expect.arrayContaining([
          expect.objectContaining({ actionType: 'reconcile_mismatch' }),
          expect.objectContaining({ actionType: 'adherence_counseling' }),
          expect.objectContaining({ actionType: 'safety_review' }),
        ]),
        counselingMaterialId: 'edu-1',
      }),
    );
    expect(result.substitutionRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceMedicationName: 'Lipitor',
          genericAlternative: 'atorvastatin',
        }),
        expect.objectContaining({
          sourceMedicationName: 'Augmentin',
          genericAlternative: 'amoxicillin clavulanate',
        }),
      ]),
    );

    const hydrated = await service.getReviewById(tenantDb, 'review-1');
    expect(hydrated.substitutionRecommendations).toHaveLength(2);
  });

  it('persists shortage-risk inventory forecasts from recent dispensing demand', async () => {
    const forecastRows: any[] = [];
    const forecastRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: value.id ?? `forecast-${forecastRows.length + 1}`, ...value };
        forecastRows.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ inventoryId, forecastHorizonDays }) =>
        forecastRows.find((row) => row.inventoryId === inventoryId && row.forecastHorizonDays === forecastHorizonDays) ?? null,
      ),
      createQueryBuilder: jest.fn(() => ({
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => forecastRows),
      })),
    };

    const tenantDb = {
      query: jest.fn(async () => ([
        {
          inventory_id: 'inv-1',
          inventory_name: 'Amoxicillin 500mg',
          category: 'antibiotic',
          quantity_on_hand: 20,
          quantity_reserved: 0,
          reorder_level: 15,
          reorder_quantity: 40,
          maximum_stock_level: 120,
          quantity_dispensed_lookback: 90,
          last_dispensed_at: '2026-03-25',
        },
        {
          inventory_id: 'inv-2',
          inventory_name: 'Vitamin C',
          category: 'supplement',
          quantity_on_hand: 300,
          quantity_reserved: 0,
          reorder_level: 20,
          reorder_quantity: 50,
          maximum_stock_level: 500,
          quantity_dispensed_lookback: 0,
          last_dispensed_at: null,
        },
      ])),
      getRepository: jest.fn((entity: any) => {
        if (entity === PharmacyInventoryForecast) {
          return forecastRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new PharmacyIntelligenceService(
      { getMedications: jest.fn() } as any,
      { assessMedicationSafety: jest.fn() } as any,
      { optimizeOnPrescription: jest.fn() } as any,
      { generate: jest.fn() } as any,
      { checkHighRiskMedications: jest.fn() } as any,
    );

    const result = await service.generateInventoryForecasts(
      tenantDb,
      { horizonDays: 30, lookbackDays: 30 },
      'user-1',
    );

    expect(result.forecasts).toHaveLength(1);
    expect(result.forecasts[0]).toEqual(
      expect.objectContaining({
        inventoryId: 'inv-1',
        shortageRisk: 'critical',
      }),
    );
    expect(result.forecasts[0].recommendedOrderQuantity).toBeGreaterThan(0);
  });

  it('persists refill and quantity anomalies from recent dispensing patterns', async () => {
    const anomalyRows: any[] = [];
    const anomalyRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: value.id ?? `anomaly-${anomalyRows.length + 1}`, ...value };
        anomalyRows.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ dispensingItemId, anomalyType }) =>
        anomalyRows.find((row) => row.dispensingItemId === dispensingItemId && row.anomalyType === anomalyType) ?? null,
      ),
      createQueryBuilder: jest.fn(() => ({
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => anomalyRows),
      })),
    };

    const tenantDb = {
      query: jest.fn(async () => ([
        {
          dispensing_item_id: 'item-1',
          dispensing_id: 'disp-1',
          patient_id: 'patient-1',
          prescription_id: 'rx-1',
          dispensing_date: '2026-03-01',
          inventory_id: 'inv-1',
          quantity_dispensed: 10,
          medication_name: 'Tramadol',
          category: 'opioid',
        },
        {
          dispensing_item_id: 'item-2',
          dispensing_id: 'disp-2',
          patient_id: 'patient-1',
          prescription_id: 'rx-2',
          dispensing_date: '2026-03-05',
          inventory_id: 'inv-1',
          quantity_dispensed: 40,
          medication_name: 'Tramadol',
          category: 'opioid',
        },
      ])),
      getRepository: jest.fn((entity: any) => {
        if (entity === PharmacyDispensingAnomaly) {
          return anomalyRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new PharmacyIntelligenceService(
      { getMedications: jest.fn() } as any,
      { assessMedicationSafety: jest.fn() } as any,
      { optimizeOnPrescription: jest.fn() } as any,
      { generate: jest.fn() } as any,
      { checkHighRiskMedications: jest.fn() } as any,
    );

    const result = await service.detectDispensingAnomalies(tenantDb, { lookbackDays: 90, limit: 50 });

    expect(result.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ anomalyType: 'quantity_outlier', dispensingItemId: 'item-2' }),
        expect.objectContaining({ anomalyType: 'early_refill', dispensingItemId: 'item-2' }),
        expect.objectContaining({ anomalyType: 'controlled_pattern', dispensingItemId: 'item-2' }),
      ]),
    );
  });

  it('persists antimicrobial stewardship reviews from high-risk medication analysis', async () => {
    const stewardshipRows: any[] = [];
    const stewardshipRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: value.id ?? `stew-${stewardshipRows.length + 1}`, ...value };
        stewardshipRows.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ prescriptionId }) =>
        stewardshipRows.find((row) => row.prescriptionId === prescriptionId) ?? null,
      ),
      createQueryBuilder: jest.fn(() => ({
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => stewardshipRows),
      })),
    };

    const tenantDb = {
      query: jest.fn(async () => ([
        {
          id: 'rx-1',
          patient_id: 'patient-1',
          doctor_id: 'doctor-1',
          medication_name: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'tds',
          duration: '7 days',
          prescribed_date: '2026-03-20T10:00:00.000Z',
          instructions: null,
          status: 'active',
        },
      ])),
      getRepository: jest.fn((entity: any) => {
        if (entity === AntimicrobialStewardship) {
          return stewardshipRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const cdssService = {
      checkHighRiskMedications: jest.fn().mockResolvedValue({
        warnings: ['Renal adjustment recommended'],
        renal_alerts: [{ medication: 'Amoxicillin', severity: 'moderate' }],
        high_alert_medications: [],
      }),
    };

    const service = new PharmacyIntelligenceService(
      { getMedications: jest.fn() } as any,
      { assessMedicationSafety: jest.fn() } as any,
      { optimizeOnPrescription: jest.fn() } as any,
      { generate: jest.fn() } as any,
      cdssService as any,
    );

    const result = await service.generateHighRiskMedicationReview(
      tenantDb,
      {
        prescriptionId: 'rx-1',
        patientGender: 'female',
        renalFunction: 44,
        cultureSent: true,
      },
      'pharmacist-1',
    );

    expect(cdssService.checkHighRiskMedications).toHaveBeenCalled();
    expect(result.stewardshipReviews).toHaveLength(1);
    expect(result.stewardshipReviews[0]).toEqual(
      expect.objectContaining({
        patientId: 'patient-1',
        prescriptionId: 'rx-1',
        antibioticName: 'Amoxicillin',
        reviewRequired: true,
      }),
    );
  });
});
