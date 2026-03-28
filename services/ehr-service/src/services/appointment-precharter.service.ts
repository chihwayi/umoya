import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { EncounterPrechart } from '../entities/encounter-prechart.entity';
import { CdssService } from './cdss.service';

interface CdssPatientSummary {
  clinical_summary?: string;
  active_problems?: any[];
  current_medications?: any[];
  allergies?: any[];
  last_lab_abnormalities?: any[];
  last_imaging_findings?: any[];
}

interface CdssCareGap {
  gap_type?: string;
  description?: string;
  recommended_action?: string;
  priority?: string;
}

interface CdssRiskResult {
  risk_level?: string;
  risk_score?: number;
  flags?: Array<{ type: string; description: string }>;
}

interface CdssDiagnosisSuggestion {
  text: string;
  icd?: string;
  confidence: number;
}

@Injectable()
export class AppointmentPrecharterService {
  private readonly logger = new Logger(AppointmentPrecharterService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  /** Runs every 30 minutes — finds appointments starting in 25–35 min and pre-charts them. */
  @Cron(process.env.PRECHART_CRON || '*/30 * * * *')
  async runPrecharting(): Promise<void> {
    const tenants = await this.tenantService.getAllActiveTenants();
    for (const tenant of tenants) {
      const tenantDb = await this.tenantService.getTenantDatabase(tenant.subdomain);
      if (!tenantDb) continue;
      try {
        await this.precharTenant(tenantDb, tenant.subdomain);
      } catch (err: any) {
        this.logger.error(`Precharting failed for ${tenant.subdomain}: ${String(err?.message || err)}`);
      }
    }
  }

  /** Generate a pre-chart for a specific appointment on demand (provider can trigger manually). */
  async generateForAppointment(appointmentId: string, tenantDb: DataSource, tenantId?: string): Promise<EncounterPrechart> {
    const repo = tenantDb.getRepository(EncounterPrechart);

    const apptRows = await tenantDb.query(
      `SELECT a.id, a.patient_id, a.start_time FROM appointments a WHERE a.id = $1`,
      [appointmentId],
    );
    if (!apptRows.length) throw new Error(`Appointment ${appointmentId} not found`);

    return this.buildPrechart(apptRows[0], tenantDb, repo, tenantId);
  }

  async getPrechart(appointmentId: string, tenantDb: DataSource): Promise<EncounterPrechart | null> {
    return tenantDb.getRepository(EncounterPrechart).findOne({ where: { appointmentId } });
  }

  async markReviewed(appointmentId: string, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(EncounterPrechart).update(
      { appointmentId },
      { providerReviewed: true, providerReviewedAt: new Date() },
    );
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async precharTenant(tenantDb: DataSource, tenantSlug: string): Promise<void> {
    // Find appointments starting in 25–35 minutes that haven't been pre-charted yet
    const upcoming = await tenantDb.query(`
      SELECT a.id, a.patient_id, a.start_time
      FROM appointments a
      LEFT JOIN encounter_precharts ep ON ep.appointment_id = a.id
      WHERE a.start_time BETWEEN NOW() + INTERVAL '25 minutes'
                              AND NOW() + INTERVAL '35 minutes'
        AND ep.id IS NULL
        AND (a.status IS NULL OR a.status NOT IN ('cancelled', 'no_show'))
    `);

    if (!upcoming.length) return;

    this.logger.log(`[${tenantSlug}] Pre-charting ${upcoming.length} appointment(s)`);
    const repo = tenantDb.getRepository(EncounterPrechart);

    for (const appt of upcoming) {
      try {
        await this.buildPrechart(appt, tenantDb, repo, tenantSlug);
      } catch (err: any) {
        this.logger.warn(`[${tenantSlug}] Prechart failed for appt ${appt.id}: ${String(err?.message || err)}`);
      }
    }
  }

  private async buildPrechart(
    appt: { id: string; patient_id: string; start_time: Date },
    tenantDb: DataSource,
    repo: ReturnType<DataSource['getRepository']>,
    tenantId?: string,
  ): Promise<EncounterPrechart> {
    const patientId = appt.patient_id;
    const appointmentId = appt.id;

    // Fetch patient context for CDSS calls
    const patientRows = await tenantDb.query(
      `SELECT p.id, p.first_name, p.last_name, p.date_of_birth, p.gender
       FROM patients p WHERE p.id = $1`,
      [patientId],
    );
    if (!patientRows.length) throw new Error(`Patient ${patientId} not found`);
    const patient = patientRows[0];

    // Last 3 visits' chief complaints
    const lastVisits = await tenantDb.query(
      `SELECT mr.chief_complaint FROM medical_records mr
       WHERE mr.patient_id = $1
       ORDER BY mr.visit_date DESC LIMIT 3`,
      [patientId],
    );
    const chiefComplaints = lastVisits
      .map((v: any) => v.chief_complaint)
      .filter(Boolean);

    // Active diagnoses
    const problems = await tenantDb.query(
      `SELECT code, description FROM problems WHERE patient_id = $1 AND status = 'active'`,
      [patientId],
    );

    // 1. Patient clinical summary
    let summary: CdssPatientSummary = {};
    try {
      summary = await this.cdssService.patientSummarize(
        {
          patientId,
          patientName: `${patient.first_name} ${patient.last_name}`,
          dob: patient.date_of_birth,
          gender: patient.gender,
        },
        tenantId,
        tenantDb,
      ) as CdssPatientSummary;
    } catch (err: any) {
      this.logger.warn(`CDSS patient summary error: ${String(err?.message || err)}`);
    }

    // 2. Care gap detection
    let careGaps: CdssCareGap[] = [];
    try {
      const careGapResult = await this.cdssService.detectCareGaps(
        this.calcAge(patient.date_of_birth),
        patient.gender,
        [],
        problems.map((p: any) => p.description).filter(Boolean),
        {
          tenantId,
          tenantDb,
          patientId,
          context: 'previsit_planning',
          specialty: 'primary_care',
          module: 'previsit_planning',
        },
      );
      careGaps = (careGapResult?.care_gaps || careGapResult?.gaps || []) as CdssCareGap[];
    } catch (err: any) {
      this.logger.warn(`CDSS care gap detection error: ${String(err?.message || err)}`);
    }

    // 3. Intelligent diagnosis suggestions (based on last chief complaints)
    let diagnosisSuggestions: CdssDiagnosisSuggestion[] = [];
    if (chiefComplaints.length) {
      try {
        const diagnosisResult = await this.cdssService.diagnosisAssist(
          {
            patientId,
            symptoms: [chiefComplaints[0]],
            chiefComplaint: chiefComplaints[0],
            age: this.calcAge(patient.date_of_birth),
            gender: patient.gender,
            conditions: problems.map((p: any) => p.description).filter(Boolean),
            priorComplaints: chiefComplaints.slice(1),
            context: 'previsit_planning_diagnosis',
            specialty: 'primary_care',
            module: 'previsit_planning',
          },
          true,
          tenantId,
          tenantDb,
        );
        diagnosisSuggestions = ((diagnosisResult?.suggested_diagnoses || []) as any[]).map((item: any) => ({
          text: item.diagnosis || item.text || 'Unspecified condition',
          icd: item.icd10 || item.icd,
          confidence: Number(item.confidence || item.probability || 0),
        }));
      } catch (err: any) {
        this.logger.warn(`CDSS intelligent diagnosis error: ${String(err?.message || err)}`);
      }
    }

    // 4. Risk score calculation
    let riskResult: CdssRiskResult = {};
    try {
      const riskAssessment = await this.cdssService.riskAssessment(
        {
          patientId,
          age: this.calcAge(patient.date_of_birth),
          gender: patient.gender,
          diagnoses: problems.map((p: any) => p.description).filter(Boolean),
          context: 'previsit_planning',
          specialty: 'primary_care',
          module: 'previsit_planning',
        },
        tenantDb,
        tenantId,
      );
      riskResult = {
        risk_level: riskAssessment?.risk_level,
        risk_score: riskAssessment?.overall_score,
        flags: Array.isArray(riskAssessment?.factors)
          ? riskAssessment.factors.slice(0, 5).map((factor: any) => ({
              type: String(factor?.impact || riskAssessment?.risk_level || 'risk'),
              description: String(factor?.factor || factor?.name || factor),
            }))
          : [],
      };
    } catch (err: any) {
      this.logger.warn(`CDSS risk calculation error: ${String(err?.message || err)}`);
    }

    // Build suggested agenda from care gaps + diagnosis suggestions
    const suggestedAgenda: string[] = [
      ...careGaps.slice(0, 3).map((g) => `Address care gap: ${g.description || g.gap_type}`),
      ...diagnosisSuggestions.slice(0, 2).map((d) => `Review possible diagnosis: ${d.text}${d.icd ? ` (${d.icd})` : ''}`),
    ].filter(Boolean);

    // Upsert (appointment_id is unique — update if already exists, e.g. from manual trigger)
    const existing = await repo.findOne({ where: { appointmentId } });
    const prechart = existing ?? repo.create({ appointmentId, patientId });

    prechart.generatedAt         = new Date();
    prechart.clinicalSummary     = summary.clinical_summary ?? null;
    prechart.activeProblems      = summary.active_problems      ?? problems.map((p: any) => ({ code: p.code, description: p.description }));
    prechart.currentMedications  = summary.current_medications  ?? [];
    prechart.allergies           = summary.allergies             ?? [];
    prechart.outstandingCareGaps = careGaps;
    prechart.suggestedAgenda     = suggestedAgenda;
    prechart.riskFlags           = riskResult.flags ?? (riskResult.risk_level ? [{ type: riskResult.risk_level, description: `Risk score: ${riskResult.risk_score ?? 'N/A'}` }] : []);
    prechart.lastLabAbnormalities  = summary.last_lab_abnormalities  ?? [];
    prechart.lastImagingFindings   = summary.last_imaging_findings    ?? [];

    return repo.save(prechart as EncounterPrechart);
  }

  private calcAge(dob: string | Date | null): number {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now   = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }
}
