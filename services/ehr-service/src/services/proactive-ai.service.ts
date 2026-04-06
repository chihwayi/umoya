import { Injectable, Logger } from '@nestjs/common';
import { PatientAiSnapshot } from '../entities/patient-ai-snapshot.entity';
import { ProactiveAlert, AlertStatus, AlertSeverity, AlertCategory } from '../entities/proactive-alert.entity';
import { PatientRiskScore } from '../entities/patient-risk-score.entity';
import { CdssService } from './cdss.service';
import { TenantService } from './tenant.service';
import { CriticalAlertGateway } from '../gateways/critical-alert.gateway';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';

export interface ProactiveTriggerContext {
  patientId: string;
  tenantId: string;
  triggeredByUserId?: string;
  triggerType: 'chart_open' | 'vitals' | 'labs' | 'prescription' | 'admission' | 'batch' | 'manual';
  // Pass only recent data — do NOT pass full history
  freshVitals?: Record<string, any>;
  freshLabs?: any[];
  freshPrescriptions?: any[];
}

@Injectable()
export class ProactiveAiService {
  private readonly logger = new Logger(ProactiveAiService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly alertGateway: CriticalAlertGateway,
  ) {}

  /**
   * Main entry point. Called from controllers at trigger points.
   * Runs asynchronously — does NOT block the triggering HTTP response.
   */
  async triggerAnalysis(ctx: ProactiveTriggerContext): Promise<void> {
    this.runAnalysis(ctx).catch(err =>
      this.logger.error(`Proactive analysis failed [${ctx.triggerType}/${ctx.patientId}]: ${err.message}`)
    );
  }

  /**
   * Synchronous version — used when the caller NEEDS the result inline
   * (e.g. chart-open returns summary immediately).
   */
  async runAnalysisSync(ctx: ProactiveTriggerContext): Promise<PatientAiSnapshot | null> {
    return this.runAnalysis(ctx);
  }

  private async runAnalysis(ctx: ProactiveTriggerContext): Promise<PatientAiSnapshot | null> {
    try {
      const db = await this.tenantService.getTenantDatabase(ctx.tenantId);
      if (!db) return null;

      // 1. Build condensed patient payload from DB
      const patientPayload = await this.buildPatientPayload(ctx, db);
      if (!patientPayload) return null;

      // 2. Call CDSS
      const analysis = await this.cdssService.proactiveAnalysis(patientPayload, ctx.tenantId, db);
      if (!analysis) return null;

      // 3. Store snapshot (upsert — one row per patient)
      const snapshot = await this.upsertSnapshot(ctx, analysis, db);

      // 4. Store risk scores (historical series)
      await this.storeRiskScores(ctx, analysis, snapshot.id, db);

      // 5. Generate and store alerts (with deduplication)
      const newAlerts = await this.processAlerts(ctx, analysis, snapshot.id, db);

      // 6. Push via WebSocket to any connected clinicians caring for this patient
      if (newAlerts.length > 0) {
        await this.pushAlerts(ctx, newAlerts, snapshot, db);
      }

      return snapshot;
    } catch (err) {
      this.logger.error(`runAnalysis error: ${(err as any).message}`);
      return null;
    }
  }

  private async buildPatientPayload(ctx: ProactiveTriggerContext, db: DataSource): Promise<any> {
    const { patientId, tenantId, freshVitals, freshLabs, freshPrescriptions } = ctx;

    const patient = await db.query(
      `SELECT id, date_of_birth, gender, chronic_conditions, allergies, pregnancy_status
       FROM patients WHERE id = $1`,
      [patientId]
    );
    if (!patient.length) return null;
    const p = patient[0];

    const age = p.date_of_birth
      ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 0;

    const latestVitals = freshVitals ?? await db.query(
      `SELECT systolic_bp, diastolic_bp, heart_rate, temperature, oxygen_saturation,
              respiratory_rate, weight, height, bmi, blood_glucose, glasgow_coma_scale
       FROM vitals WHERE patient_id = $1
       ORDER BY recorded_at DESC LIMIT 1`,
      [patientId]
    ).then((rows: any[]) => rows[0] || {});

    const meds = freshPrescriptions ?? await db.query(
      `SELECT medication_name, dosage, frequency
       FROM prescriptions WHERE patient_id = $1 AND status = 'active' LIMIT 20`,
      [patientId]
    );

    const labs = freshLabs ?? await db.query(
      `SELECT tests, results, created_at FROM lab_orders
       WHERE patient_id = $1 AND status = 'completed'
       ORDER BY created_at DESC LIMIT 5`,
      [patientId]
    );

    const diagnoses = await db.query(
      `SELECT diagnoses, visit_date FROM medical_records
       WHERE patient_id = $1
       ORDER BY visit_date DESC LIMIT 3`,
      [patientId]
    ).then((rows: any[]) => rows.flatMap((r: any) => r.diagnoses || []));

    const visits = await db.query(
      `SELECT chief_complaint, assessment, visit_date FROM medical_records
       WHERE patient_id = $1
       ORDER BY visit_date DESC LIMIT 3`,
      [patientId]
    );

    return {
      patient_id: patientId,
      age,
      gender: p.gender || 'unknown',
      chronic_conditions: this.parseStringArray(p.chronic_conditions),
      active_medications: meds.map((m: any) => ({ name: m.medication_name, dosage: m.dosage })),
      allergies: this.parseStringArray(p.allergies),
      latest_vitals: latestVitals,
      latest_labs: labs.map((l: any) => l.results || []).flat().slice(0, 10),
      recent_diagnoses: diagnoses.slice(0, 6),
      recent_visits_summary: visits.map((v: any) => ({
        date: v.visit_date,
        chief_complaint: v.chief_complaint,
        assessment: v.assessment?.substring(0, 200),
      })),
      pregnancy_status: p.pregnancy_status,
      hiv_status: null,
      trigger_type: ctx.triggerType,
      tenant_id: tenantId,
    };
  }

  private parseStringArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return [value]; }
    }
    return [];
  }

  private async upsertSnapshot(ctx: ProactiveTriggerContext, analysis: any, db: DataSource): Promise<PatientAiSnapshot> {
    const snapshotRepo = db.getRepository(PatientAiSnapshot);
    const existing = await snapshotRepo.findOne({
      where: { patientId: ctx.patientId, tenantId: ctx.tenantId }
    });

    const data: Partial<PatientAiSnapshot> = {
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      clinicalSummary: analysis.clinical_summary,
      analysisPayload: analysis,
      riskScores: analysis.risk_scores,
      activeFlags: (analysis.active_alerts || []).map((a: any) => a.category),
      guidelineCitations: analysis.guideline_citations || [],
      triggerType: ctx.triggerType,
      news2Score: analysis.news2_score,
      qsofaScore: analysis.qsofa_score,
      modelVersion: analysis.model_version,
      snapshotGeneratedAt: new Date(),
      triggeredByUserId: ctx.triggeredByUserId || null,
    };

    if (existing) {
      await snapshotRepo.update(existing.id, data);
      return { ...existing, ...data } as PatientAiSnapshot;
    } else {
      return snapshotRepo.save(snapshotRepo.create(data));
    }
  }

  private async storeRiskScores(ctx: ProactiveTriggerContext, analysis: any, snapshotId: string, db: DataSource): Promise<void> {
    const riskScoreRepo = db.getRepository(PatientRiskScore);
    const scores = analysis.risk_scores || {};
    const levels = analysis.risk_levels || {};
    const entries = Object.entries(scores).map(([type, value]) => ({
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      scoreType: type,
      scoreValue: value as number,
      riskLevel: levels[type] || 'unknown',
      triggerType: ctx.triggerType,
      modelVersion: analysis.model_version,
      snapshotId,
      scoredAt: new Date(),
    }));
    if (entries.length) {
      await riskScoreRepo.save(riskScoreRepo.create(entries as any));
    }
  }

  private async processAlerts(ctx: ProactiveTriggerContext, analysis: any, snapshotId: string, db: DataSource): Promise<ProactiveAlert[]> {
    const alertRepo = db.getRepository(ProactiveAlert);
    const rawAlerts = [...(analysis.active_alerts || []), ...(analysis.care_gaps || [])];
    const newAlerts: ProactiveAlert[] = [];

    for (const raw of rawAlerts) {
      const dedupKey = crypto
        .createHash('md5')
        .update(`${ctx.patientId}:${raw.category || raw.type}:${raw.title}`)
        .digest('hex');

      const existing = await alertRepo.findOne({
        where: { patientId: ctx.patientId, dedupKey, status: AlertStatus.ACTIVE }
      });
      if (existing) continue;

      const alert = alertRepo.create({
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        category: (raw.category || raw.type || 'care_gap') as AlertCategory,
        severity: (raw.severity || raw.priority || AlertSeverity.MEDIUM) as AlertSeverity,
        status: AlertStatus.ACTIVE,
        title: raw.title,
        message: raw.message,
        recommendedAction: raw.recommended_action,
        guidelineReference: raw.guideline_reference,
        triggerData: raw.trigger_data || {},
        triggerType: ctx.triggerType,
        confidenceScore: raw.confidence || null,
        snapshotId,
        dedupKey,
        expiresAt: new Date(Date.now() + (raw.severity === 'critical' ? 4 : 24) * 3600 * 1000),
      });
      newAlerts.push(await alertRepo.save(alert));
    }

    return newAlerts;
  }

  private async pushAlerts(ctx: ProactiveTriggerContext, alerts: ProactiveAlert[], snapshot: PatientAiSnapshot, db: DataSource): Promise<void> {
    const careTeam = await db.query(
      `SELECT DISTINCT doctor_id as user_id FROM appointments
       WHERE patient_id = $1 AND status IN ('in_progress','checked_in')
       AND appointment_date >= NOW() - INTERVAL '8 hours'
       UNION
       SELECT DISTINCT recorded_by as user_id FROM vitals
       WHERE patient_id = $1 AND created_at >= NOW() - INTERVAL '8 hours'`,
      [ctx.patientId]
    );

    const payload = {
      type: 'proactive_analysis',
      patientId: ctx.patientId,
      clinicalSummary: snapshot.clinicalSummary,
      riskScores: snapshot.riskScores,
      alerts: alerts.map(a => ({
        id: a.id,
        category: a.category,
        severity: a.severity,
        title: a.title,
        message: a.message,
        recommendedAction: a.recommendedAction,
        guidelineReference: a.guidelineReference,
      })),
      news2Score: snapshot.news2Score,
      qsofaScore: snapshot.qsofaScore,
      triggerType: ctx.triggerType,
      generatedAt: snapshot.snapshotGeneratedAt,
    };

    for (const member of careTeam) {
      if (member.user_id) {
        this.alertGateway.sendToUser(member.user_id, payload);
      }
    }

    if (ctx.triggeredByUserId) {
      this.alertGateway.sendToUser(ctx.triggeredByUserId, payload);
    }
  }

  // ── Public query methods ───────────────────────────────────────

  async getSnapshot(patientId: string, tenantId: string): Promise<PatientAiSnapshot | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) return null;
    return db.getRepository(PatientAiSnapshot).findOne({ where: { patientId, tenantId } });
  }

  async getActiveAlerts(patientId: string, tenantId: string): Promise<ProactiveAlert[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) return [];
    return db.getRepository(ProactiveAlert).find({
      where: { patientId, tenantId, status: AlertStatus.ACTIVE },
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  async acknowledgeAlert(alertId: string, userId: string, tenantId: string): Promise<ProactiveAlert | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) return null;
    const alertRepo = db.getRepository(ProactiveAlert);
    const alert = await alertRepo.findOne({ where: { id: alertId, tenantId } });
    if (!alert) return null;
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedById = userId;
    alert.acknowledgedAt = new Date();
    return alertRepo.save(alert);
  }

  async dismissAlert(alertId: string, userId: string, tenantId: string): Promise<ProactiveAlert | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) return null;
    const alertRepo = db.getRepository(ProactiveAlert);
    const alert = await alertRepo.findOne({ where: { id: alertId, tenantId } });
    if (!alert) return null;
    alert.status = AlertStatus.DISMISSED;
    alert.acknowledgedById = userId;
    alert.acknowledgedAt = new Date();
    return alertRepo.save(alert);
  }

  async getWardActiveAlerts(tenantId: string, severity?: string): Promise<ProactiveAlert[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) return [];
    const qb = db.getRepository(ProactiveAlert)
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.status = :status', { status: AlertStatus.ACTIVE })
      .andWhere('(a.expires_at IS NULL OR a.expires_at > NOW())')
      .orderBy(`CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`, 'ASC')
      .addOrderBy('a.created_at', 'DESC')
      .limit(100);
    if (severity) qb.andWhere('a.severity = :severity', { severity });
    return qb.getMany();
  }

  async getRiskScoreHistory(patientId: string, tenantId: string, scoreType: string, days = 7): Promise<PatientRiskScore[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) return [];
    return db.getRepository(PatientRiskScore)
      .createQueryBuilder('r')
      .where('r.patient_id = :patientId', { patientId })
      .andWhere('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.score_type = :scoreType', { scoreType })
      .andWhere(`r.scored_at >= NOW() - INTERVAL '${days} days'`)
      .orderBy('r.scored_at', 'ASC')
      .getMany();
  }
}
