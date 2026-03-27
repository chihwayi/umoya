import { Injectable, Logger } from '@nestjs/common';
import { CdssService } from './cdss.service';
import { TenantService } from './tenant.service';
import { PatientRiskTier } from '../entities/patient-risk-tier.entity';
import { RiskStratificationBatch } from '../entities/risk-stratification-batch.entity';

@Injectable()
export class RiskStratificationService {
  private readonly logger = new Logger(RiskStratificationService.name);

  constructor(
    private readonly cdssService: CdssService,
    private readonly tenantService: TenantService,
  ) {}

  /**
   * Get current risk tier for a single patient.
   * Used by PatientDashboard and CareGapPanel.
   */
  async getPatientRiskTier(patientId: string, tenantId: string): Promise<PatientRiskTier | null> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return null;

    const riskTierRepo = tenantDb.getRepository(PatientRiskTier);
    const existing = await riskTierRepo.findOne({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    // If tier is fresh (< 24 hours), return cached
    if (existing && existing.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return existing;
    }

    // Otherwise compute on-demand
    return this.computeRiskTier(patientId, tenantId, null);
  }

  async computeRiskTier(
    patientId: string,
    tenantId: string,
    batchRunId: string | null,
  ): Promise<PatientRiskTier> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) throw new Error(`Tenant DB not found for ${tenantId}`);

    const patientData = await this.gatherPatientFeatures(patientId, tenantDb);

    const result = await this.cdssService.stratifyPatientRisk(patientData, tenantId);

    const riskTierRepo = tenantDb.getRepository(PatientRiskTier);

    // Upsert: remove old tier, insert fresh
    await riskTierRepo.delete({ patientId });

    const tier = riskTierRepo.create({
      patientId,
      tier: result.tier as any,
      compositeScore: result.composite_score,
      chronicConditionScore: result.chronic_condition_score,
      vitalsTrendScore: result.vitals_trend_score,
      adherenceScore: result.adherence_score,
      sdohScore: result.sdoh_score,
      noShowRate: result.no_show_rate,
      labTrendScore: result.lab_trend_score,
      contributingFactors: result.contributing_factors,
      recommendedActions: result.recommended_actions,
      modelVersion: result.model_version,
      batchRunId,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return riskTierRepo.save(tier);
  }

  /**
   * Nightly batch job: stratify all active patients for a tenant.
   */
  async runBatch(tenantId: string): Promise<RiskStratificationBatch> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) throw new Error(`Tenant DB not found for ${tenantId}`);

    const patientRows = await tenantDb.query(
      `SELECT id FROM patients WHERE active = true OR active IS NULL LIMIT 10000`,
    );

    const batchRepo = tenantDb.getRepository(RiskStratificationBatch);
    const batch = await batchRepo.save(
      batchRepo.create({
        tenantId,
        totalPatients: patientRows.length,
        status: 'running',
      }),
    );

    let criticalCount = 0;
    let highCount = 0;
    let processed = 0;

    for (const row of patientRows) {
      try {
        const tier = await this.computeRiskTier(row.id, tenantId, batch.id);
        if (tier.tier === 'critical') criticalCount++;
        if (tier.tier === 'high') highCount++;
        processed++;
      } catch (err) {
        this.logger.warn(`Risk stratification failed for patient ${row.id}: ${err}`);
      }
    }

    await batchRepo.update(batch.id, {
      processedPatients: processed,
      criticalCount,
      highCount,
      status: 'completed',
      completedAt: new Date(),
    });

    this.logger.log(`Risk stratification batch complete: ${processed}/${patientRows.length} patients. Critical: ${criticalCount}, High: ${highCount}`);
    return { ...batch, processedPatients: processed, criticalCount, highCount, status: 'completed' };
  }

  private async gatherPatientFeatures(patientId: string, tenantDb: any): Promise<Record<string, unknown>> {
    const [conditions, vitals, prescriptions, sdoh, appointments, abnormalLabs] = await Promise.allSettled([
      tenantDb.query(
        `SELECT description FROM problems WHERE patient_id = $1 AND status = 'active' LIMIT 20`,
        [patientId],
      ),
      tenantDb.query(
        `SELECT total_score FROM patient_early_warning_scores WHERE patient_id = $1 ORDER BY calculated_at DESC LIMIT 1`,
        [patientId],
      ),
      tenantDb.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'dispensed' THEN 1 ELSE 0 END) as dispensed
         FROM pharmacy_dispensings WHERE patient_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
        [patientId],
      ),
      tenantDb.query(
        `SELECT positive_screens FROM sdoh_screening_logs
         WHERE patient_id = $1 AND jsonb_array_length(positive_screens) > 0
         ORDER BY created_at DESC LIMIT 5`,
        [patientId],
      ),
      tenantDb.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_shows
         FROM appointments WHERE patient_id = $1 AND appointment_date > NOW() - INTERVAL '180 days'`,
        [patientId],
      ),
      tenantDb.query(
        `SELECT COUNT(DISTINCT lo.id)::int AS abnormal_count
         FROM lab_orders lo,
              jsonb_array_elements(lo.results) AS r
         WHERE lo.patient_id = $1
           AND lo.created_at > NOW() - INTERVAL '30 days'
           AND lo.status = 'resulted'
           AND r->>'flag' IN ('high', 'low', 'critical')`,
        [patientId],
      ),
    ]);

    const conditionNames = (conditions.status === 'fulfilled' ? conditions.value : [])
      .map((r: any) => r.description);
    const news2 = (vitals.status === 'fulfilled' && vitals.value.length > 0)
      ? Number(vitals.value[0].total_score) : 0;
    const rxStats = prescriptions.status === 'fulfilled' && prescriptions.value.length > 0
      ? prescriptions.value[0] : { total: 0, dispensed: 0 };
    const adherencePct = rxStats.total > 0
      ? Math.round((Number(rxStats.dispensed) / Number(rxStats.total)) * 100) : 100;
    const sdohRows = (sdoh.status === 'fulfilled' ? sdoh.value : []);
    const sdohFactors: string[] = sdohRows.flatMap((r: any) => {
      const screens = Array.isArray(r.positive_screens) ? r.positive_screens : [];
      return screens.map((s: any) =>
        typeof s === 'string' ? s : (s.domain ?? s.category ?? s.code ?? 'sdoh_risk')
      );
    });
    const apptStats = appointments.status === 'fulfilled' && appointments.value.length > 0
      ? appointments.value[0] : { total: 0, no_shows: 0 };
    const noShowRate = apptStats.total > 0
      ? Number(apptStats.no_shows) / Number(apptStats.total) : 0;

    return {
      active_conditions: conditionNames,
      news2_score: news2,
      medication_adherence_pct: adherencePct,
      sdoh_risk_factors: sdohFactors,
      appointment_no_show_rate: noShowRate,
      abnormal_lab_count_30d: (abnormalLabs.status === 'fulfilled' && abnormalLabs.value.length > 0)
        ? Number(abnormalLabs.value[0].abnormal_count) : 0,
    };
  }
}
