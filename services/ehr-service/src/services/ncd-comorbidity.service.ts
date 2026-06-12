import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { NcdComorbidityProfile } from '../entities/ncd-comorbidity-profile.entity';

// Framingham 10-year CVD risk (simplified — points table approximation)
function framinghamRisk(p: { age: number; gender: string; sbp: number; onBpMeds: boolean; totalChol: number; hdl: number; smoking: boolean; diabetes: boolean }): number {
  const { age, gender, sbp, onBpMeds, totalChol, hdl, smoking, diabetes } = p;
  const isMale = gender?.toLowerCase() === 'male';
  let points = 0;

  if (isMale) {
    if (age >= 70) points += 11;
    else if (age >= 65) points += 10;
    else if (age >= 60) points += 9;
    else if (age >= 55) points += 8;
    else if (age >= 50) points += 6;
    else if (age >= 45) points += 5;
    else if (age >= 40) points += 4;
    else points += 3;
    if (totalChol >= 7.2) points += 4;
    else if (totalChol >= 6.2) points += 3;
    else if (totalChol >= 5.2) points += 2;
    else if (totalChol >= 4.1) points += 1;
    if (hdl < 0.9) points += 2;
    else if (hdl < 1.2) points += 1;
    else if (hdl >= 1.6) points -= 1;
    const sbpPts = onBpMeds
      ? sbp >= 160 ? 3 : sbp >= 130 ? 2 : sbp >= 120 ? 1 : -1
      : sbp >= 160 ? 2 : sbp >= 130 ? 1 : 0;
    points += sbpPts;
    if (smoking) points += 4;
    if (diabetes) points += 3;
    const riskMap: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 8, 12: 10, 13: 12, 14: 16, 15: 20 };
    return riskMap[Math.min(points, 15)] ?? (points > 15 ? 30 : 1);
  }

  if (age >= 75) points += 16;
  else if (age >= 70) points += 14;
  else if (age >= 65) points += 13;
  else if (age >= 60) points += 12;
  else if (age >= 55) points += 11;
  else if (age >= 50) points += 10;
  else if (age >= 45) points += 8;
  else if (age >= 40) points += 7;
  else points += 6;
  if (totalChol >= 7.2) points += 3;
  else if (totalChol >= 6.2) points += 2;
  else if (totalChol >= 5.2) points += 1;
  if (hdl < 0.9) points += 3;
  else if (hdl < 1.3) points += 2;
  else if (hdl < 1.6) points += 1;
  else if (hdl >= 2.0) points -= 2;
  const sbpPtsF = onBpMeds
    ? sbp >= 160 ? 6 : sbp >= 130 ? 5 : sbp >= 120 ? 3 : sbp >= 110 ? 1 : -1
    : sbp >= 160 ? 4 : sbp >= 130 ? 3 : sbp >= 120 ? 1 : 0;
  points += sbpPtsF;
  if (smoking) points += 3;
  if (diabetes) points += 4;
  const riskMapF: Record<number, number> = { 9: 1, 10: 1, 11: 1, 12: 1, 13: 2, 14: 2, 15: 3, 16: 4, 17: 5, 18: 6, 19: 8, 20: 11, 21: 14, 22: 17, 23: 22, 24: 27 };
  return riskMapF[Math.min(points, 24)] ?? (points > 24 ? 30 : 1);
}

@Injectable()
export class NcdComorbidityService {
  private readonly logger = new Logger(NcdComorbidityService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async getOrCreateProfile(tenantId: string, patientId: string): Promise<NcdComorbidityProfile> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NcdComorbidityProfile);
    const existing = await repo.findOne({ where: { patientId } });
    if (existing) return existing;
    return repo.save(repo.create({ patientId }));
  }

  async updateProfile(tenantId: string, patientId: string, data: Partial<NcdComorbidityProfile>): Promise<NcdComorbidityProfile> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NcdComorbidityProfile);
    const existing = await repo.findOne({ where: { patientId } });
    if (existing) {
      await repo.update(existing.id, data as any);
      return repo.findOne({ where: { patientId } }) as Promise<NcdComorbidityProfile>;
    }
    return repo.save(repo.create({ ...data, patientId }));
  }

  // Aggregates data from all specialty modules for a patient into a unified NCD profile
  async syncProfile(tenantId: string, patientId: string): Promise<NcdComorbidityProfile & { riskAssessment: any }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    // Pull latest data from each specialty module
    const [dmRecord] = await db.query(
      `SELECT hba1c_value, hba1c_date, diabetes_type FROM diabetes_registry WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [patientId],
    ).catch(() => [null]);

    const [bpRecord] = await db.query(
      `SELECT systolic, diastolic, recorded_at FROM vitals WHERE patient_id = $1 AND systolic IS NOT NULL ORDER BY recorded_at DESC LIMIT 1`,
      [patientId],
    ).catch(() => [null]);

    const [ckdRecord] = await db.query(
      `SELECT stage, egfr_value, assessment_date FROM ckd_assessment WHERE patient_id = $1 ORDER BY assessment_date DESC LIMIT 1`,
      [patientId],
    ).catch(() => [null]);

    const [retinoRecord] = await db.query(
      `SELECT grade, screening_date, next_screening_date FROM retinopathy_screening WHERE patient_id = $1 ORDER BY screening_date DESC LIMIT 1`,
      [patientId],
    ).catch(() => [null]);

    const [lipidRecord] = await db.query(
      `SELECT ldl_value, ldl_date FROM diabetes_care_bundle WHERE patient_id = $1 AND ldl_value IS NOT NULL ORDER BY bundle_date DESC LIMIT 1`,
      [patientId],
    ).catch(() => [null]);

    // Build update from cross-module data
    const update: Partial<NcdComorbidityProfile> = {};
    if (dmRecord) {
      update.hasDiabetes = true;
      update.diabetesType = dmRecord.diabetes_type ?? null;
      update.hba1cLatest = dmRecord.hba1c_value ?? null;
      update.hba1cDate = dmRecord.hba1c_date ?? null;
    }
    if (bpRecord) {
      update.hasHypertension = true;
      update.bpSystolicLatest = bpRecord.systolic;
      update.bpDiastolicLatest = bpRecord.diastolic;
      update.bpDate = bpRecord.recorded_at?.toISOString?.()?.slice(0, 10) ?? null;
    }
    if (ckdRecord) {
      update.hasCkd = true;
      update.ckdStage = ckdRecord.stage ?? null;
      update.egfrLatest = ckdRecord.egfr_value ?? null;
      update.egfrDate = ckdRecord.assessment_date ?? null;
    }
    if (retinoRecord) {
      update.hasRetinopathy = retinoRecord.grade && retinoRecord.grade !== 'none';
      update.retinopathyGrade = retinoRecord.grade ?? null;
      update.lastEyeReviewDate = retinoRecord.screening_date ?? null;
      update.nextEyeReviewDate = retinoRecord.next_screening_date ?? null;
    }
    if (lipidRecord) {
      update.hasDyslipidaemia = true;
      update.ldlLatestMmolL = lipidRecord.ldl_value ?? null;
      update.ldlDate = lipidRecord.ldl_date ?? null;
    }

    // Generate alerts
    const alerts: string[] = [];
    if (update.hba1cLatest && update.hba1cLatest > 8) alerts.push(`HbA1c ${update.hba1cLatest}% above target — intensify DM management`);
    if (update.bpSystolicLatest && update.bpSystolicLatest > 140) alerts.push(`BP ${update.bpSystolicLatest}/${update.bpDiastolicLatest} mmHg — uncontrolled hypertension`);
    if (update.egfrLatest && update.egfrLatest < 30) alerts.push(`eGFR ${update.egfrLatest} mL/min — CKD stage G4/G5 — nephrology review`);
    if (update.hasDiabetes && !update.lastEyeReviewDate) alerts.push('Annual retinopathy screening overdue');
    if (update.ldlLatestMmolL && update.ldlLatestMmolL > 3.0 && !update.onStatin) alerts.push('LDL elevated — statin therapy recommended');

    update.alerts = alerts;
    const profile = await this.updateProfile(tenantId, patientId, update);

    // CDSS cardiovascular risk assessment
    const cdss = await this.cdssService.riskAssessment({
      patientId,
      diagnoses: [
        ...(update.hasDiabetes ? ['diabetes mellitus'] : []),
        ...(update.hasHypertension ? ['hypertension'] : []),
        ...(update.hasCkd ? [`CKD ${update.ckdStage ?? ''}`] : []),
        ...(update.hasCvd ? ['cardiovascular disease'] : []),
      ],
      vitals: bpRecord ? { systolic: bpRecord.systolic, diastolic: bpRecord.diastolic } : {},
      context: 'ncd_comorbidity_review',
      specialty: 'internal_medicine',
      module: 'ncd_comorbidity',
    }, null as any, undefined).catch(() => null);

    return { ...profile, riskAssessment: { alerts, cdss: cdss ?? { cdssUnavailable: true } } };
  }

  async cvdRisk(tenantId: string, payload: Record<string, any>): Promise<any> {
    const risk10yr = framinghamRisk({
      age: Number(payload.age ?? 50),
      gender: payload.gender ?? 'male',
      sbp: Number(payload.sbp ?? 120),
      onBpMeds: payload.onBpMeds === true,
      totalChol: Number(payload.totalCholMmolL ?? 5),
      hdl: Number(payload.hdlMmolL ?? 1.3),
      smoking: payload.smoking === true,
      diabetes: payload.diabetes === true,
    });

    const riskCategory = risk10yr >= 20 ? 'very_high' : risk10yr >= 10 ? 'high' : risk10yr >= 5 ? 'moderate' : 'low';
    const recommendation = riskCategory === 'very_high'
      ? 'Very high CVD risk — statin therapy + aspirin (if no contraindication) + intensive BP control target <130/80 mmHg. Lifestyle: smoking cessation, diet, exercise'
      : riskCategory === 'high'
      ? 'High CVD risk — statin therapy, BP target <140/90 mmHg, lifestyle modification'
      : riskCategory === 'moderate'
      ? 'Moderate CVD risk — lifestyle modification; consider statin if LDL ≥3.5 mmol/L'
      : 'Low CVD risk — lifestyle advice; reassess in 5 years';

    const cdss = await this.cdssService.riskAssessment({
      patientId: payload.patientId,
      diagnoses: payload.diagnoses ?? [],
      vitals: { systolic: payload.sbp },
      context: 'cardiovascular_risk',
      specialty: 'internal_medicine',
      module: 'cvd_risk_stratification',
    }, null as any, undefined).catch(() => null);

    return { framinghamRisk10yr: risk10yr, riskCategory, recommendation, cdss: cdss ?? { cdssUnavailable: true } };
  }
}
