import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FormularyOptimizationService } from './formulary-optimization.service';
import { MedicationSafetyService } from './medication-safety.service';
import { MedicationHistoryService } from './medication-history.service';
import { MultilingualEducationService } from './multilingual-education.service';
import { CdssService } from './cdss.service';
import { MedicationReconciliationAiReview } from '../entities/medication-reconciliation-ai-review.entity';
import { PharmacySubstitutionRecommendation } from '../entities/pharmacy-substitution-recommendation.entity';
import { PharmacyInventoryForecast } from '../entities/pharmacy-inventory-forecast.entity';
import { PharmacyDispensingAnomaly } from '../entities/pharmacy-dispensing-anomaly.entity';
import { AntimicrobialStewardship } from '../entities/antimicrobial-stewardship.entity';

interface PharmacyMedicationInput {
  name?: string;
  genericName?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  prescriptionId?: string | null;
  source?: string | null;
}

@Injectable()
export class PharmacyIntelligenceService {
  constructor(
    private readonly medicationHistoryService: MedicationHistoryService,
    private readonly medicationSafetyService: MedicationSafetyService,
    private readonly formularyOptimizationService: FormularyOptimizationService,
    private readonly multilingualEducationService: MultilingualEducationService,
    private readonly cdssService: CdssService,
  ) {}

  async generateMedicationReview(
    tenantId: string,
    tenantDb: DataSource,
    payload: {
      patientId: string;
      encounterId?: string;
      language?: string;
      readingLevel?: number;
      reportedMedications?: PharmacyMedicationInput[];
    },
    actorUserId?: string | null,
  ) {
    if (!payload?.patientId) {
      throw new BadRequestException('patientId is required');
    }

    const reportedMedications = Array.isArray(payload.reportedMedications)
      ? payload.reportedMedications
      : [];
    const currentMedications = await this.medicationHistoryService.getMedications(
      tenantDb,
      payload.patientId,
    );

    const activeCurrent = currentMedications.filter(
      (med) => med.medicationType === 'current' && med.status === 'active',
    );

    const discrepancySummary = this.buildDiscrepancySummary(activeCurrent, reportedMedications);
    const duplicateTherapySignals = this.buildDuplicateTherapySignals(activeCurrent, reportedMedications);
    const adherenceConcerns = this.buildAdherenceConcerns(activeCurrent);
    const safetyAlerts = await this.medicationSafetyService.assessMedicationSafety(
      tenantDb,
      payload.patientId,
      [
        ...activeCurrent.map((med) => ({
          name: med.medicationName,
          genericName: med.genericName,
        })),
        ...reportedMedications.map((med) => ({
          name: med.name,
          genericName: med.genericName,
        })),
      ],
    );

    const recommendedActions = this.buildRecommendedActions({
      discrepancySummary,
      duplicateTherapySignals,
      adherenceConcerns,
      safetyAlerts,
    });

    const counselingTopic = this.buildCounselingTopic(activeCurrent, discrepancySummary, adherenceConcerns);
    const counselingMaterial = await this.multilingualEducationService.generate(
      tenantId,
      payload.patientId,
      counselingTopic,
      payload.language || 'en',
      payload.readingLevel || 6,
      payload.encounterId,
    );

    const reviewRepo = tenantDb.getRepository(MedicationReconciliationAiReview);
    const review = await reviewRepo.save(
      reviewRepo.create({
        patientId: payload.patientId,
        encounterId: payload.encounterId ?? null,
        generatedBy: actorUserId ?? null,
        reviewStatus: 'generated',
        reportedMedications,
        currentMedications: activeCurrent.map((med) => ({
          id: med.id,
          medicationName: med.medicationName,
          genericName: med.genericName ?? null,
          dosage: med.dosage,
          frequency: med.frequency,
          adherencePercentage: med.adherencePercentage ?? null,
          reconciliationStatus: med.reconciliationStatus,
          prescriptionId: med.prescriptionId ?? null,
        })),
        historySummary: {
          totalMedicationCount: currentMedications.length,
          activeMedicationCount: activeCurrent.length,
          reportedMedicationCount: reportedMedications.length,
        },
        discrepancySummary,
        duplicateTherapySignals,
        adherenceConcerns,
        safetyAlerts,
        recommendedActions,
        counselingMaterialId: counselingMaterial?.id ?? null,
        governance: {
          governedPath: true,
          workstream: 'MOAS-07',
          generatedAt: new Date().toISOString(),
        },
      }),
    );

    const substitutionRecommendations = await this.generateSubstitutionRecommendations(
      tenantId,
      tenantDb,
      review.id,
      payload.patientId,
      activeCurrent,
    );

    return {
      review,
      substitutionRecommendations,
      counselingMaterial,
    };
  }

  async getReviewById(tenantDb: DataSource, id: string) {
    const review = await tenantDb.getRepository(MedicationReconciliationAiReview).findOneBy({ id });
    if (!review) {
      throw new BadRequestException(`Medication AI review ${id} not found`);
    }

    const substitutionRecommendations = await tenantDb.getRepository(PharmacySubstitutionRecommendation).find({
      where: { reviewId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      ...review,
      substitutionRecommendations,
    };
  }

  async generateInventoryForecasts(
    tenantDb: DataSource,
    payload?: {
      horizonDays?: number;
      lookbackDays?: number;
      inventoryIds?: string[];
    },
    actorUserId?: string | null,
  ) {
    const horizonDays = this.normalizeDays(payload?.horizonDays, 30);
    const lookbackDays = Math.max(this.normalizeDays(payload?.lookbackDays, 45), horizonDays);
    const inventoryIds = Array.isArray(payload?.inventoryIds)
      ? payload!.inventoryIds.filter(Boolean)
      : [];

    const params: any[] = [lookbackDays];
    let inventoryFilter = '';
    if (inventoryIds.length > 0) {
      params.push(inventoryIds);
      inventoryFilter = ` AND pi.id = ANY($${params.length}::uuid[])`;
    }

    const rows = await tenantDb.query(
      `SELECT
         pi.id AS inventory_id,
         COALESCE(pi.name, pi.generic_name, d.generic_name, 'Inventory item') AS inventory_name,
         COALESCE(pi.category, 'uncategorized') AS category,
         COALESCE(pi.quantity_on_hand, 0)::int AS quantity_on_hand,
         COALESCE(pi.quantity_reserved, 0)::int AS quantity_reserved,
         COALESCE(pi.reorder_level, 0)::int AS reorder_level,
         COALESCE(pi.reorder_quantity, 0)::int AS reorder_quantity,
         COALESCE(pi.maximum_stock_level, pi.max_stock_level, 0)::int AS maximum_stock_level,
         COALESCE(SUM(
           CASE
             WHEN pd.id IS NOT NULL AND pd.status IN ('dispensed', 'partial')
             THEN ABS(COALESCE(pdi.quantity_dispensed, 0))
             ELSE 0
           END
         ), 0)::numeric AS quantity_dispensed_lookback,
         MAX(pd.dispensing_date) AS last_dispensed_at
       FROM pharmacy_inventory pi
       LEFT JOIN drugs d ON d.id = pi.drug_id
       LEFT JOIN pharmacy_dispensing_items pdi ON pdi.inventory_id = pi.id
       LEFT JOIN pharmacy_dispensings pd
         ON pd.id = pdi.dispensing_id
        AND pd.dispensing_date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
       WHERE pi.status = 'active'${inventoryFilter}
       GROUP BY
         pi.id,
         pi.name,
         pi.generic_name,
         d.generic_name,
         pi.category,
         pi.quantity_on_hand,
         pi.quantity_reserved,
         pi.reorder_level,
         pi.reorder_quantity,
         pi.maximum_stock_level,
         pi.max_stock_level
       ORDER BY COALESCE(pi.name, pi.generic_name, d.generic_name, 'Inventory item') ASC`,
      params,
    );

    const repo = tenantDb.getRepository(PharmacyInventoryForecast);
    const results: PharmacyInventoryForecast[] = [];

    for (const row of rows) {
      const metrics = this.calculateInventoryForecast(row, lookbackDays, horizonDays);
      const shouldPersist =
        Number(row.quantity_dispensed_lookback || 0) > 0 ||
        metrics.shortageRisk !== 'low' ||
        Number(row.quantity_on_hand || 0) <= Number(row.reorder_level || 0) * 2;

      if (!shouldPersist) {
        continue;
      }

      const existing = await repo.findOneBy({
        inventoryId: row.inventory_id,
        forecastHorizonDays: horizonDays,
      });

      const entity = repo.create({
        ...(existing ?? {}),
        inventoryId: row.inventory_id,
        generatedById: actorUserId ?? existing?.generatedById ?? null,
        forecastHorizonDays: horizonDays,
        lookbackDays,
        forecastStatus: 'generated',
        inventorySnapshot: {
          inventoryName: row.inventory_name,
          category: row.category,
          quantityOnHand: Number(row.quantity_on_hand || 0),
          quantityReserved: Number(row.quantity_reserved || 0),
          reorderLevel: Number(row.reorder_level || 0),
          reorderQuantity: Number(row.reorder_quantity || 0),
          maximumStockLevel: Number(row.maximum_stock_level || 0),
        },
        usageMetrics: {
          quantityDispensedLookback: Number(row.quantity_dispensed_lookback || 0),
          averageDailyUsage: metrics.averageDailyUsage,
          projectedDemand: metrics.projectedDemand,
          horizonDays,
          lookbackDays,
          lastDispensedAt: row.last_dispensed_at,
        },
        projectedDemand: metrics.projectedDemand,
        averageDailyUsage: metrics.averageDailyUsage,
        predictedStockoutDate: metrics.predictedStockoutDate,
        daysUntilStockout: metrics.daysUntilStockout,
        shortageRisk: metrics.shortageRisk,
        recommendedOrderQuantity: metrics.recommendedOrderQuantity,
        evidence: {
          forecastSignals: metrics.forecastSignals,
        },
        governance: {
          governedPath: true,
          workstream: 'MOAS-07',
          source: 'pharmacy_inventory_forecast',
          generatedAt: new Date().toISOString(),
        },
      });

      results.push(await repo.save(entity));
    }

    return {
      generatedAt: new Date().toISOString(),
      horizonDays,
      lookbackDays,
      forecasts: results.sort((a, b) => this.rankShortageRisk(b.shortageRisk) - this.rankShortageRisk(a.shortageRisk)),
    };
  }

  async listInventoryForecasts(
    tenantDb: DataSource,
    filters?: {
      shortageRisk?: string;
      limit?: number;
    },
  ) {
    const repo = tenantDb.getRepository(PharmacyInventoryForecast);
    const take = Math.max(1, Math.min(Number(filters?.limit || 50), 200));
    const qb = repo.createQueryBuilder('forecast')
      .orderBy('forecast.createdAt', 'DESC')
      .take(take);

    if (filters?.shortageRisk) {
      qb.andWhere('forecast.shortageRisk = :shortageRisk', { shortageRisk: filters.shortageRisk });
    }

    return qb.getMany();
  }

  async detectDispensingAnomalies(
    tenantDb: DataSource,
    payload?: {
      lookbackDays?: number;
      limit?: number;
    },
  ) {
    const lookbackDays = this.normalizeDays(payload?.lookbackDays, 90);
    const limit = Math.max(10, Math.min(Number(payload?.limit || 200), 500));
    const rows = await tenantDb.query(
      `SELECT
         pdi.id AS dispensing_item_id,
         pd.id AS dispensing_id,
         pd.patient_id,
         pd.prescription_id,
         pd.dispensing_date,
         pdi.inventory_id,
         pdi.quantity_dispensed,
         COALESCE(pi.name, pi.generic_name, d.generic_name, 'Medication') AS medication_name,
         COALESCE(pi.category, '') AS category
       FROM pharmacy_dispensing_items pdi
       INNER JOIN pharmacy_dispensings pd ON pd.id = pdi.dispensing_id
       LEFT JOIN pharmacy_inventory pi ON pi.id = pdi.inventory_id
       LEFT JOIN drugs d ON d.id = pi.drug_id
       WHERE pd.dispensing_date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
         AND pd.status IN ('dispensed', 'partial')
       ORDER BY pd.patient_id, pdi.inventory_id, pd.dispensing_date ASC
       LIMIT $2`,
      [lookbackDays, limit],
    );

    const grouped = new Map<string, Array<any>>();
    for (const row of rows) {
      const key = `${row.patient_id}:${row.inventory_id}`;
      const existing = grouped.get(key) || [];
      existing.push(row);
      grouped.set(key, existing);
    }

    const repo = tenantDb.getRepository(PharmacyDispensingAnomaly);
    const persisted: PharmacyDispensingAnomaly[] = [];

    for (const items of grouped.values()) {
      const ordered = items.sort((a, b) => new Date(a.dispensing_date).getTime() - new Date(b.dispensing_date).getTime());
      const prior: Array<any> = [];

      for (const item of ordered) {
        const anomalies = this.calculateDispensingAnomalies(item, prior);
        for (const anomaly of anomalies) {
          const existing = await repo.findOneBy({
            dispensingItemId: item.dispensing_item_id,
            anomalyType: anomaly.anomalyType,
          });

          const entity = repo.create({
            ...(existing ?? {}),
            dispensingId: item.dispensing_id,
            dispensingItemId: item.dispensing_item_id,
            patientId: item.patient_id,
            prescriptionId: item.prescription_id ?? null,
            inventoryId: item.inventory_id,
            anomalyType: anomaly.anomalyType,
            severity: anomaly.severity,
            anomalyScore: anomaly.anomalyScore,
            status: existing?.status ?? 'open',
            medicationName: item.medication_name,
            rationale: anomaly.rationale,
            evidence: anomaly.evidence,
            governance: {
              governedPath: true,
              workstream: 'MOAS-07',
              source: 'dispensing_anomaly_detection',
              generatedAt: new Date().toISOString(),
            },
          });

          persisted.push(await repo.save(entity));
        }

        prior.push(item);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      lookbackDays,
      anomalies: persisted.sort((a, b) => Number(b.anomalyScore) - Number(a.anomalyScore)),
    };
  }

  async listDispensingAnomalies(
    tenantDb: DataSource,
    filters?: {
      status?: string;
      severity?: string;
      limit?: number;
    },
  ) {
    const repo = tenantDb.getRepository(PharmacyDispensingAnomaly);
    const take = Math.max(1, Math.min(Number(filters?.limit || 50), 200));
    const qb = repo.createQueryBuilder('anomaly')
      .orderBy('anomaly.createdAt', 'DESC')
      .take(take);

    if (filters?.status) {
      qb.andWhere('anomaly.status = :status', { status: filters.status });
    }
    if (filters?.severity) {
      qb.andWhere('anomaly.severity = :severity', { severity: filters.severity });
    }

    return qb.getMany();
  }

  async generateHighRiskMedicationReview(
    tenantDb: DataSource,
    payload: {
      patientId?: string;
      prescriptionId?: string;
      medications?: Array<Record<string, any>>;
      patientAge?: number;
      patientGender?: string;
      diagnoses?: string[];
      renalFunction?: number;
      route?: string;
      indication?: string;
      cultureSent?: boolean;
      cultureSource?: string;
      cultureResult?: string;
      organismIdentified?: string;
      sensitivityProfile?: Record<string, any>;
      plannedDurationDays?: number;
      startDate?: string;
    },
    actorUserId?: string | null,
  ) {
    const prescription = payload.prescriptionId
      ? await this.getPrescriptionContext(tenantDb, payload.prescriptionId)
      : null;
    const patientId = payload.patientId ?? prescription?.patient_id;
    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    const medications = Array.isArray(payload.medications) && payload.medications.length > 0
      ? payload.medications
      : prescription
        ? [{
            name: prescription.medication_name,
            medicationName: prescription.medication_name,
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            route: payload.route ?? 'oral',
            duration: prescription.duration ?? null,
            indication: payload.indication ?? prescription.indication ?? null,
          }]
        : [];

    if (!medications.length) {
      throw new BadRequestException('At least one medication or prescriptionId is required');
    }

    const highRiskAnalysis = await this.cdssService.checkHighRiskMedications(
      medications,
      payload.patientAge,
      payload.patientGender,
      payload.diagnoses,
      payload.renalFunction,
    );

    const stewardshipRepo = tenantDb.getRepository(AntimicrobialStewardship);
    const stewardshipReviews: AntimicrobialStewardship[] = [];

    for (const medication of medications) {
      if (!this.isAntibioticMedication(medication?.name ?? medication?.medicationName ?? medication?.genericName)) {
        continue;
      }

      const recommendation = this.buildStewardshipRecommendation(
        medication,
        highRiskAnalysis,
        payload.cultureResult,
      );
      const existing = payload.prescriptionId
        ? await stewardshipRepo.findOneBy({ prescriptionId: payload.prescriptionId })
        : null;

      const entity = stewardshipRepo.create({
        ...(existing ?? {}),
        patientId,
        prescriptionId: payload.prescriptionId ?? existing?.prescriptionId ?? null,
        antibioticName: medication?.name ?? medication?.medicationName ?? medication?.genericName ?? 'Antibiotic',
        antibioticClass: this.inferAntibioticClass(medication?.name ?? medication?.medicationName ?? medication?.genericName),
        dose: medication?.dosage ?? prescription?.dosage ?? 'unspecified',
        route: medication?.route ?? payload.route ?? 'oral',
        frequency: medication?.frequency ?? prescription?.frequency ?? 'unspecified',
        indication: medication?.indication ?? payload.indication ?? 'infection review',
        indicationIcd10: null,
        empiricOrTargeted: payload.cultureResult ? 'targeted' : 'empiric',
        cultureSent: Boolean(payload.cultureSent),
        cultureSource: payload.cultureSource ?? null,
        cultureResult: payload.cultureResult ?? null,
        organismIdentified: payload.organismIdentified ?? null,
        sensitivityProfile: payload.sensitivityProfile ?? null,
        startDate: payload.startDate ? new Date(payload.startDate) : (prescription?.prescribed_date ? new Date(prescription.prescribed_date) : new Date()),
        plannedDurationDays: payload.plannedDurationDays ?? this.parseDurationDays(prescription?.duration),
        actualStopDate: null,
        totalDaysGiven: null,
        reviewRequired: true,
        reviewDate: existing?.reviewDate ?? null,
        reviewedById: existing?.reviewedById ?? null,
        stewardshipRecommendation: recommendation.summary,
        recommendationFollowed: existing?.recommendationFollowed ?? null,
        appropriateIndication: recommendation.appropriateIndication,
        appropriateDose: recommendation.appropriateDose,
        appropriateDuration: recommendation.appropriateDuration,
        deEscalationOpportunity: recommendation.deEscalationOpportunity,
        deEscalationNotes: recommendation.deEscalationNotes,
        prescribedById: prescription?.doctor_id ?? actorUserId ?? existing?.prescribedById,
        notes: 'Generated by MOAS-07 pharmacy intelligence high-risk review',
      });

      stewardshipReviews.push(await stewardshipRepo.save(entity));
    }

    return {
      patientId,
      prescriptionId: payload.prescriptionId ?? null,
      highRiskAnalysis,
      stewardshipReviews,
      generatedAt: new Date().toISOString(),
    };
  }

  async listStewardshipReviews(
    tenantDb: DataSource,
    filters?: {
      patientId?: string;
      reviewRequired?: boolean;
      limit?: number;
    },
  ) {
    const repo = tenantDb.getRepository(AntimicrobialStewardship);
    const take = Math.max(1, Math.min(Number(filters?.limit || 50), 200));
    const qb = repo.createQueryBuilder('stewardship')
      .orderBy('stewardship.createdAt', 'DESC')
      .take(take);

    if (filters?.patientId) {
      qb.andWhere('stewardship.patientId = :patientId', { patientId: filters.patientId });
    }
    if (filters?.reviewRequired !== undefined) {
      qb.andWhere('stewardship.reviewRequired = :reviewRequired', { reviewRequired: filters.reviewRequired });
    }

    return qb.getMany();
  }

  private async generateSubstitutionRecommendations(
    tenantId: string,
    tenantDb: DataSource,
    reviewId: string,
    patientId: string,
    medications: Array<any>,
  ) {
    const repo = tenantDb.getRepository(PharmacySubstitutionRecommendation);
    const rows: PharmacySubstitutionRecommendation[] = [];

    for (const medication of medications) {
      const suggestion = await this.formularyOptimizationService.optimizeOnPrescription(
        tenantId,
        medication.prescriptionId ?? null,
        patientId,
        medication.medicationName,
      );

      if (!suggestion?.genericAlternative && !suggestion?.savingAmount) {
        continue;
      }

      rows.push(
        repo.create({
          reviewId,
          patientId,
          prescriptionId: medication.prescriptionId ?? null,
          sourceMedicationName: medication.medicationName,
          sourceGenericName: medication.genericName ?? null,
          genericAlternative: suggestion.genericAlternative ?? null,
          recommendationStatus: suggestion.aiRecommendation === 'no_substitute' ? 'no_substitute' : 'recommended',
          recommendationType: 'formulary_substitution',
          costImpact: {
            brandedCost: suggestion.brandedCost ?? null,
            genericCost: suggestion.genericCost ?? null,
            savingAmount: suggestion.savingAmount ?? null,
            medicalAidCoverage: suggestion.medicalAidCoverage ?? null,
            medicalAidTier: suggestion.medicalAidTier ?? null,
          },
          evidence: {
            equivalence: suggestion.evidenceEquivalence ?? null,
            accepted: suggestion.accepted ?? null,
          },
          rationale: suggestion.reason ?? null,
          governance: {
            governedPath: true,
            source: 'formulary_ai_suggestions',
            workstream: 'MOAS-07',
          },
        }),
      );
    }

    if (!rows.length) {
      return [];
    }

    return repo.save(rows);
  }

  private buildDiscrepancySummary(currentMedications: Array<any>, reportedMedications: PharmacyMedicationInput[]) {
    const currentKeys = new Set(currentMedications.map((med) => this.normalizeMedicationKey(med)));
    const reportedKeys = new Set(reportedMedications.map((med) => this.normalizeMedicationKey(med)));

    const missingFromReported = currentMedications
      .filter((med) => !reportedKeys.has(this.normalizeMedicationKey(med)))
      .map((med) => ({
        type: 'missing_from_reported',
        medicationName: med.medicationName,
        genericName: med.genericName ?? null,
        message: 'Active medication exists on record but was not reported in the reconciliation input.',
      }));

    const reportedNotOnRecord = reportedMedications
      .filter((med) => !currentKeys.has(this.normalizeMedicationKey(med)))
      .map((med) => ({
        type: 'reported_not_on_record',
        medicationName: med.name ?? med.genericName ?? 'Reported medication',
        genericName: med.genericName ?? null,
        message: 'Reported medication is not present in the active medication record.',
      }));

    return [...missingFromReported, ...reportedNotOnRecord];
  }

  private buildDuplicateTherapySignals(currentMedications: Array<any>, reportedMedications: PharmacyMedicationInput[]) {
    const all = [
      ...currentMedications.map((med) => ({
        label: med.medicationName,
        genericName: med.genericName ?? med.medicationName,
        source: 'current_record',
      })),
      ...reportedMedications.map((med) => ({
        label: med.name ?? med.genericName ?? 'Reported medication',
        genericName: med.genericName ?? med.name ?? 'Reported medication',
        source: med.source ?? 'reported',
      })),
    ];

    const grouped = new Map<string, Array<Record<string, any>>>();
    for (const item of all) {
      const key = this.normalizeText(item.genericName || item.label);
      if (!key) continue;
      const existing = grouped.get(key) || [];
      existing.push(item);
      grouped.set(key, existing);
    }

    return Array.from(grouped.entries())
      .filter(([, values]) => values.length > 1)
      .map(([genericName, values]) => ({
        type: 'duplicate_therapy',
        genericName,
        occurrences: values,
        message: 'Potential duplicate therapy detected across active and reported medication sources.',
      }));
  }

  private buildAdherenceConcerns(currentMedications: Array<any>) {
    return currentMedications
      .filter((med) => med.adherencePercentage !== null && med.adherencePercentage !== undefined && med.adherencePercentage < 80)
      .map((med) => ({
        medicationId: med.id,
        medicationName: med.medicationName,
        adherencePercentage: med.adherencePercentage,
        message: 'Medication adherence is below the target threshold and should drive pharmacist counseling.',
      }));
  }

  private buildRecommendedActions(args: {
    discrepancySummary: Array<Record<string, any>>;
    duplicateTherapySignals: Array<Record<string, any>>;
    adherenceConcerns: Array<Record<string, any>>;
    safetyAlerts: Record<string, any>;
  }) {
    const actions: Array<Record<string, any>> = [];

    if (args.discrepancySummary.length > 0) {
      actions.push({
        actionType: 'reconcile_mismatch',
        priority: 'high',
        message: 'Review medications present in one source but missing in the other before dispensing.',
      });
    }
    if (args.duplicateTherapySignals.length > 0) {
      actions.push({
        actionType: 'duplicate_therapy_review',
        priority: 'high',
        message: 'Resolve duplicate therapy risk before confirming the medication list.',
      });
    }
    if (args.adherenceConcerns.length > 0) {
      actions.push({
        actionType: 'adherence_counseling',
        priority: 'medium',
        message: 'Provide pharmacist counseling for low-adherence medications.',
      });
    }

    const hasPregnancyAlerts = Array.isArray(args.safetyAlerts?.pregnancy?.alerts) && args.safetyAlerts.pregnancy.alerts.length > 0;
    const hasRenalAlerts = Array.isArray(args.safetyAlerts?.renal?.alerts) && args.safetyAlerts.renal.alerts.length > 0;
    const hasHepaticAlerts = Array.isArray(args.safetyAlerts?.hepatic?.alerts) && args.safetyAlerts.hepatic.alerts.length > 0;
    if (hasPregnancyAlerts || hasRenalAlerts || hasHepaticAlerts) {
      actions.push({
        actionType: 'safety_review',
        priority: 'high',
        message: 'Medication safety alerts require pharmacist review before substitution or dispensing.',
      });
    }

    return actions;
  }

  private buildCounselingTopic(
    currentMedications: Array<any>,
    discrepancySummary: Array<Record<string, any>>,
    adherenceConcerns: Array<Record<string, any>>,
  ) {
    const medicationNames = currentMedications.slice(0, 3).map((med) => med.medicationName).filter(Boolean);
    const mismatchNote = discrepancySummary.length > 0 ? ' Include reconciliation mismatches and verification reminders.' : '';
    const adherenceNote = adherenceConcerns.length > 0 ? ' Emphasize adherence barriers, refill timing, and what to do after missed doses.' : '';
    return `Medication counseling for ${medicationNames.join(', ') || 'current medicines'}.${mismatchNote}${adherenceNote}`;
  }

  private normalizeMedicationKey(medication: any) {
    return this.normalizeText(medication?.genericName || medication?.medicationName || medication?.name);
  }

  private calculateInventoryForecast(row: any, lookbackDays: number, horizonDays: number) {
    const quantityOnHand = Number(row.quantity_on_hand || 0);
    const reorderLevel = Number(row.reorder_level || 0);
    const reorderQuantity = Number(row.reorder_quantity || 0);
    const maximumStockLevel = Number(row.maximum_stock_level || 0);
    const quantityDispensedLookback = Number(row.quantity_dispensed_lookback || 0);
    const averageDailyUsage = this.roundNumber(quantityDispensedLookback / Math.max(lookbackDays, 1), 4);
    const projectedDemand = this.roundNumber(averageDailyUsage * horizonDays, 2);
    const daysUntilStockout = averageDailyUsage > 0
      ? this.roundNumber(quantityOnHand / averageDailyUsage, 2)
      : null;
    const predictedStockoutDate = daysUntilStockout !== null
      ? new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000)
      : null;

    let shortageRisk = 'low';
    if (quantityOnHand <= reorderLevel || (daysUntilStockout !== null && daysUntilStockout <= 7)) {
      shortageRisk = 'critical';
    } else if (daysUntilStockout !== null && daysUntilStockout <= 14) {
      shortageRisk = 'high';
    } else if (daysUntilStockout !== null && daysUntilStockout <= 30) {
      shortageRisk = 'medium';
    } else if (quantityOnHand <= reorderLevel * 1.5) {
      shortageRisk = 'medium';
    }

    const recommendedOrderQuantity = Math.max(
      reorderQuantity,
      Math.ceil(projectedDemand + reorderLevel - quantityOnHand),
      maximumStockLevel > 0 ? Math.min(maximumStockLevel - quantityOnHand, reorderQuantity || Math.ceil(projectedDemand)) : 0,
      0,
    );

    return {
      averageDailyUsage,
      projectedDemand,
      daysUntilStockout,
      predictedStockoutDate,
      shortageRisk,
      recommendedOrderQuantity,
      forecastSignals: {
        quantityOnHand,
        reorderLevel,
        reorderQuantity,
        maximumStockLevel,
        quantityDispensedLookback,
      },
    };
  }

  private calculateDispensingAnomalies(item: any, prior: Array<any>) {
    if (!prior.length) {
      return [];
    }

    const quantityDispensed = Number(item.quantity_dispensed || 0);
    const priorAverageQuantity = prior.reduce((sum, row) => sum + Number(row.quantity_dispensed || 0), 0) / prior.length;
    const lastDispense = prior[prior.length - 1];
    const gapDays = Math.max(
      0,
      Math.round(
        (new Date(item.dispensing_date).getTime() - new Date(lastDispense.dispensing_date).getTime()) /
        (24 * 60 * 60 * 1000),
      ),
    );
    const anomalies: Array<{
      anomalyType: string;
      severity: string;
      anomalyScore: number;
      rationale: string;
      evidence: Record<string, any>;
    }> = [];

    if (priorAverageQuantity > 0 && quantityDispensed >= Math.max(priorAverageQuantity * 2, priorAverageQuantity + 10)) {
      anomalies.push({
        anomalyType: 'quantity_outlier',
        severity: quantityDispensed >= Math.max(priorAverageQuantity * 3, 30) ? 'high' : 'medium',
        anomalyScore: this.roundNumber(Math.min(0.99, quantityDispensed / Math.max(priorAverageQuantity, 1) / 3), 2),
        rationale: 'Dispensed quantity is materially higher than the patient and inventory baseline for recent fills.',
        evidence: {
          currentQuantity: quantityDispensed,
          priorAverageQuantity: this.roundNumber(priorAverageQuantity, 2),
          recentFillCount: prior.length,
          gapDays,
        },
      });
    }

    if (gapDays <= 7) {
      anomalies.push({
        anomalyType: 'early_refill',
        severity: gapDays <= 3 ? 'high' : 'medium',
        anomalyScore: this.roundNumber(Math.max(0.5, (8 - gapDays) / 8), 2),
        rationale: 'Refill timing is materially earlier than expected based on the immediately previous dispense event.',
        evidence: {
          currentQuantity: quantityDispensed,
          previousDispenseDate: lastDispense.dispensing_date,
          gapDays,
          priorAverageQuantity: this.roundNumber(priorAverageQuantity, 2),
        },
      });
    }

    if (this.isControlledMedication(item.medication_name, item.category) && (quantityDispensed >= 30 || gapDays <= 14)) {
      anomalies.push({
        anomalyType: 'controlled_pattern',
        severity: gapDays <= 7 ? 'high' : 'medium',
        anomalyScore: this.roundNumber(Math.max(0.55, quantityDispensed / 60), 2),
        rationale: 'Controlled or high-risk medication pattern needs pharmacist review because quantity or refill cadence is elevated.',
        evidence: {
          medicationName: item.medication_name,
          category: item.category,
          currentQuantity: quantityDispensed,
          gapDays,
        },
      });
    }

    return anomalies;
  }

  private rankShortageRisk(value: string) {
    switch (value) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      default:
        return 1;
    }
  }

  private isControlledMedication(medicationName?: string, category?: string) {
    const text = `${this.normalizeText(medicationName)} ${this.normalizeText(category)}`;
    return ['opioid', 'benzodiazepine', 'fentanyl', 'morphine', 'tramadol', 'codeine', 'diazepam', 'clonazepam']
      .some((token) => text.includes(token));
  }

  private isAntibioticMedication(value?: string) {
    const text = this.normalizeText(value);
    return [
      'amoxicillin',
      'augmentin',
      'cef',
      'azithromycin',
      'ciprofloxacin',
      'metronidazole',
      'vancomycin',
      'meropenem',
      'gentamicin',
      'co-trimoxazole',
      'cotrimoxazole',
      'doxycycline',
      'clarithromycin',
      'clindamycin',
      'linezolid',
      'penicillin',
      'antibiotic',
    ].some((token) => text.includes(token));
  }

  private inferAntibioticClass(value?: string) {
    const text = this.normalizeText(value);
    if (text.includes('amoxicillin') || text.includes('augmentin') || text.includes('penicillin')) {
      return 'beta_lactam';
    }
    if (text.includes('cef')) {
      return 'cephalosporin';
    }
    if (text.includes('azithro') || text.includes('clarithro')) {
      return 'macrolide';
    }
    if (text.includes('cipro') || text.includes('levo')) {
      return 'fluoroquinolone';
    }
    if (text.includes('vancomycin')) {
      return 'glycopeptide';
    }
    if (text.includes('gentamicin')) {
      return 'aminoglycoside';
    }
    return 'antimicrobial';
  }

  private parseDurationDays(value?: string | null) {
    const match = String(value || '').match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  private buildStewardshipRecommendation(
    medication: Record<string, any>,
    highRiskAnalysis: Record<string, any>,
    cultureResult?: string,
  ) {
    const recommendationLines: string[] = [];
    const warnings = Array.isArray(highRiskAnalysis?.warnings) ? highRiskAnalysis.warnings : [];
    const renalAlerts = Array.isArray(highRiskAnalysis?.renal_alerts) ? highRiskAnalysis.renal_alerts : [];
    const highAlertMedications = Array.isArray(highRiskAnalysis?.high_alert_medications)
      ? highRiskAnalysis.high_alert_medications
      : [];

    if (warnings.length > 0) {
      recommendationLines.push(...warnings.slice(0, 2));
    }
    if (renalAlerts.length > 0) {
      recommendationLines.push('Renal dosing or toxicity review is required before continuing therapy.');
    }
    if (highAlertMedications.length > 0) {
      recommendationLines.push('High-risk medication guidance requires pharmacist confirmation before dispensing.');
    }
    if (cultureResult) {
      recommendationLines.push('Culture data is available; review for targeted therapy and de-escalation opportunity.');
    } else {
      recommendationLines.push('Empiric antimicrobial therapy should be reassessed at 48-72 hours.');
    }

    return {
      summary: recommendationLines.join(' '),
      appropriateIndication: recommendationLines.length === 0 ? true : null,
      appropriateDose: renalAlerts.length > 0 ? false : null,
      appropriateDuration: this.parseDurationDays(medication?.duration) ? null : null,
      deEscalationOpportunity: Boolean(cultureResult),
      deEscalationNotes: cultureResult ? 'Culture result available; confirm de-escalation opportunity.' : null,
    };
  }

  private async getPrescriptionContext(tenantDb: DataSource, prescriptionId: string) {
    const [row] = await tenantDb.query(
      `SELECT
         id,
         patient_id,
         doctor_id,
         medication_name,
         dosage,
         frequency,
         duration,
         prescribed_date,
         instructions,
         status
       FROM prescriptions
       WHERE id = $1`,
      [prescriptionId],
    );
    return row ?? null;
  }

  private roundNumber(value: number, scale = 2) {
    const factor = 10 ** scale;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  private normalizeDays(value: number | undefined, fallback: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return fallback;
    }
    return Math.min(Math.max(Math.round(numeric), 1), 365);
  }

  private normalizeText(value: any) {
    return String(value || '').trim().toLowerCase();
  }
}
