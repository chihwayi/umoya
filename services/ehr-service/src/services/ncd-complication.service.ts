import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DiabeticFootAssessment } from '../entities/diabetic-foot-assessment.entity';
import { RetinopathyScreening } from '../entities/retinopathy-screening.entity';
import { CkdStagingRecord } from '../entities/ckd-staging-record.entity';
import { CdssService } from './cdss.service';
import { TenantService } from './tenant.service';

@Injectable()
export class NcdComplicationService {
  private readonly logger = new Logger(NcdComplicationService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  private async getTenantDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) {
      throw new ServiceUnavailableException('Tenant database connection unavailable');
    }
    return db;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private deriveOverallRetinopathyGrade(dto: Partial<RetinopathyScreening>): string | null {
    const ranking = ['none', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr', 'ungradable'];
    const grades = [dto.rightEyeGrade, dto.leftEyeGrade].filter(Boolean) as string[];
    if (!grades.length) {
      return null;
    }
    return grades.sort((a, b) => ranking.indexOf(b) - ranking.indexOf(a))[0] ?? grades[0];
  }

  private deriveRetinopathyUrgency(dto: Partial<RetinopathyScreening>): string | null {
    if (!dto.referredToOphthalmology) {
      return null;
    }
    if (dto.urgency) {
      return dto.urgency;
    }
    if (dto.rightEyeDme || dto.leftEyeDme || dto.overallGrade === 'pdr') {
      return 'urgent_within_1_week';
    }
    return 'routine';
  }

  private localCkdStage(egfr: number): string {
    if (egfr >= 90) return 'G1';
    if (egfr >= 60) return 'G2';
    if (egfr >= 45) return 'G3a';
    if (egfr >= 30) return 'G3b';
    if (egfr >= 15) return 'G4';
    return 'G5';
  }

  private localAlbuminuriaCategory(uacr: number | null | undefined): string | null {
    if (uacr === null || uacr === undefined || Number.isNaN(Number(uacr))) {
      return null;
    }
    const value = Number(uacr);
    if (value < 30) return 'A1';
    if (value < 300) return 'A2';
    return 'A3';
  }

  private async refreshPatientSummary(db: DataSource, patientId: string): Promise<void> {
    const footRows = await db.query(
      `
        SELECT right_wagner_grade, left_wagner_grade, ulcer_present
        FROM diabetic_foot_assessments
        WHERE patient_id = $1
        ORDER BY assessment_date DESC, created_at DESC
      `,
      [patientId],
    );
    const eyeRows = await db.query(
      `
        SELECT overall_grade, right_eye_dme, left_eye_dme
        FROM retinopathy_screenings
        WHERE patient_id = $1
        ORDER BY screening_date DESC, created_at DESC
      `,
      [patientId],
    );
    const kidneyRows = await db.query(
      `
        SELECT ckd_stage, egfr_ml_min_1_73m2
        FROM ckd_staging_records
        WHERE patient_id = $1
        ORDER BY record_date DESC, created_at DESC
      `,
      [patientId],
    );

    const latestFoot = footRows[0] ?? null;
    const latestEye = eyeRows[0] ?? null;
    const latestKidney = kidneyRows[0] ?? null;

    const worstWagner = footRows.reduce((max: number | null, row: any) => {
      const values = [row.right_wagner_grade, row.left_wagner_grade]
        .filter((value) => value !== null && value !== undefined)
        .map((value) => Number(value));
      if (!values.length) {
        return max;
      }
      const rowMax = Math.max(...values);
      return max === null ? rowMax : Math.max(max, rowMax);
    }, null);

    const retinopathyRank = ['none', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr', 'ungradable'];
    const worstRetinopathy = eyeRows.reduce((current: string | null, row: any) => {
      const next = row.overall_grade ?? null;
      if (!next) {
        return current;
      }
      if (!current) {
        return next;
      }
      return retinopathyRank.indexOf(next) > retinopathyRank.indexOf(current) ? next : current;
    }, null);

    const activeFootUlcer = Boolean(latestFoot?.ulcer_present);
    const dmePresent = Boolean(latestEye?.right_eye_dme || latestEye?.left_eye_dme);
    const currentCkdStage = latestKidney?.ckd_stage ?? null;
    const currentEgfr = latestKidney?.egfr_ml_min_1_73m2 ? Number(latestKidney.egfr_ml_min_1_73m2) : null;
    const complicationCount = [
      activeFootUlcer || worstWagner !== null,
      Boolean(worstRetinopathy),
      Boolean(currentCkdStage || currentEgfr !== null),
    ].filter(Boolean).length;
    const highRisk = Boolean(
      activeFootUlcer ||
      (worstWagner !== null && worstWagner >= 3) ||
      ['severe_npdr', 'pdr', 'ungradable'].includes(worstRetinopathy ?? '') ||
      dmePresent ||
      ['G3b', 'G4', 'G5'].includes(currentCkdStage ?? ''),
    );

    await db.query(
      `
        INSERT INTO ncd_complication_summaries (
          patient_id,
          worst_wagner_grade,
          active_foot_ulcer,
          worst_retinopathy_grade,
          dme_present,
          current_ckd_stage,
          current_egfr,
          complication_count,
          high_risk,
          last_updated
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (patient_id) DO UPDATE
        SET worst_wagner_grade = EXCLUDED.worst_wagner_grade,
            active_foot_ulcer = EXCLUDED.active_foot_ulcer,
            worst_retinopathy_grade = EXCLUDED.worst_retinopathy_grade,
            dme_present = EXCLUDED.dme_present,
            current_ckd_stage = EXCLUDED.current_ckd_stage,
            current_egfr = EXCLUDED.current_egfr,
            complication_count = EXCLUDED.complication_count,
            high_risk = EXCLUDED.high_risk,
            last_updated = NOW()
      `,
      [
        patientId,
        worstWagner,
        activeFootUlcer,
        worstRetinopathy,
        dmePresent,
        currentCkdStage,
        currentEgfr,
        complicationCount,
        highRisk,
      ],
    );
  }

  async recordFootAssessment(
    tenantId: string,
    assessedBy: string,
    dto: Partial<DiabeticFootAssessment>,
  ): Promise<{ assessment: DiabeticFootAssessment; riskAnalysis: Record<string, any> }> {
    const db = await this.getTenantDb(tenantId);
    const repo = db.getRepository(DiabeticFootAssessment);
    const entity = repo.create({
      ...dto,
      assessedBy,
      assessmentDate: dto.assessmentDate ?? this.today(),
      infectionSigns: dto.infectionSigns ?? [],
    } as Partial<DiabeticFootAssessment>);
    const assessment = (await repo.save(entity)) as DiabeticFootAssessment;

    let riskAnalysis: Record<string, any> = { abstained: true };
    try {
      riskAnalysis = await this.cdssService.ncdDiabeticFootRisk(
        {
          right_wagner_grade: assessment.rightWagnerGrade ?? undefined,
          left_wagner_grade: assessment.leftWagnerGrade ?? undefined,
          right_foot_sensation: assessment.rightFootSensation ?? 'intact',
          left_foot_sensation: assessment.leftFootSensation ?? 'intact',
          right_foot_pulses: assessment.rightFootPulses ?? 'present',
          left_foot_pulses: assessment.leftFootPulses ?? 'present',
          right_abi: assessment.rightAbi ?? undefined,
          left_abi: assessment.leftAbi ?? undefined,
          infection_signs: assessment.infectionSigns ?? [],
          ulcer_present: assessment.ulcerPresent ?? false,
        },
        tenantId,
      );
    } catch (error: any) {
      this.logger.warn(`NCD diabetic foot risk unavailable for ${assessment.id}: ${error?.message}`);
    }

    await this.refreshPatientSummary(db, assessment.patientId);
    return { assessment, riskAnalysis };
  }

  async getFootHistory(tenantId: string, patientId: string): Promise<DiabeticFootAssessment[]> {
    const db = await this.getTenantDb(tenantId);
    return db.getRepository(DiabeticFootAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async recordRetinopathyScreening(
    tenantId: string,
    screenedBy: string,
    dto: Partial<RetinopathyScreening>,
  ): Promise<RetinopathyScreening> {
    const db = await this.getTenantDb(tenantId);
    const repo = db.getRepository(RetinopathyScreening);
    const overallGrade = dto.overallGrade ?? this.deriveOverallRetinopathyGrade(dto);
    const entity = repo.create({
      ...dto,
      screenedBy,
      screeningDate: dto.screeningDate ?? this.today(),
      overallGrade,
      urgency: this.deriveRetinopathyUrgency({ ...dto, overallGrade }),
    } as Partial<RetinopathyScreening>);
    const screening = (await repo.save(entity)) as RetinopathyScreening;
    await this.refreshPatientSummary(db, screening.patientId);
    return screening;
  }

  async getRetinopathyHistory(tenantId: string, patientId: string): Promise<RetinopathyScreening[]> {
    const db = await this.getTenantDb(tenantId);
    return db.getRepository(RetinopathyScreening).find({
      where: { patientId },
      order: { screeningDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async recordCkdStaging(
    tenantId: string,
    recordedBy: string,
    dto: Partial<CkdStagingRecord>,
  ): Promise<{ record: CkdStagingRecord; management: Record<string, any> }> {
    const db = await this.getTenantDb(tenantId);
    const repo = db.getRepository(CkdStagingRecord);
    const egfr = dto.egfrMlMin173m2 !== null && dto.egfrMlMin173m2 !== undefined
      ? Number(dto.egfrMlMin173m2)
      : null;
    const entity = repo.create({
      ...dto,
      recordedBy,
      recordDate: dto.recordDate ?? this.today(),
      albuminuriaCategory: dto.albuminuriaCategory ?? this.localAlbuminuriaCategory(dto.uacrMgG),
      doseAdjustedDrugs: dto.doseAdjustedDrugs ?? [],
    } as Partial<CkdStagingRecord>);
    const record = (await repo.save(entity)) as CkdStagingRecord;

    let management: Record<string, any> = {};
    if (egfr !== null) {
      try {
        management = await this.cdssService.ncdCkdManagement(
          {
            egfr,
            uacr_mg_g: dto.uacrMgG ?? undefined,
            cause: dto.primaryCause ?? undefined,
            sbp: dto.sbpMmhg ?? undefined,
            potassium: dto.potassiumMmolL ?? undefined,
            on_metformin: dto.metforminStopped === false ? true : undefined,
            on_ace_arb: dto.aceInhibitorArb ?? undefined,
            haemoglobin: dto.haemoglobinGDl ?? undefined,
          },
          tenantId,
        );
      } catch (error: any) {
        this.logger.warn(`NCD CKD management unavailable for ${record.id}: ${error?.message}`);
        management = {
          ckd_stage: this.localCkdStage(egfr),
          albuminuria_category: this.localAlbuminuriaCategory(dto.uacrMgG),
          referral_required: egfr < 45,
          next_review_months: egfr < 15 ? 1 : egfr < 30 ? 3 : egfr < 45 ? 6 : 12,
          medication_flags: [],
          recommendations: [
            `CKD ${this.localCkdStage(egfr)} based on eGFR ${egfr.toFixed(1)} mL/min/1.73m2`,
            egfr < 45 ? 'Refer to nephrology for co-management' : 'Continue periodic renal surveillance',
          ],
        };
      }
      if (management?.ckd_stage) {
        await repo.update(record.id, { ckdStage: management.ckd_stage });
        record.ckdStage = management.ckd_stage;
      } else if (!record.ckdStage) {
        record.ckdStage = this.localCkdStage(egfr);
        await repo.update(record.id, { ckdStage: record.ckdStage });
      }
    }

    await this.refreshPatientSummary(db, record.patientId);
    return { record, management };
  }

  async getCkdHistory(tenantId: string, patientId: string): Promise<CkdStagingRecord[]> {
    const db = await this.getTenantDb(tenantId);
    return db.getRepository(CkdStagingRecord).find({
      where: { patientId },
      order: { recordDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async getComplicationRegister(
    tenantId: string,
    options: { complicationType?: string; highRiskOnly?: boolean } = {},
  ): Promise<any[]> {
    const db = await this.getTenantDb(tenantId);
    const rows = await db.query(
      `
        SELECT
          p.id AS patient_id,
          p.first_name,
          p.last_name,
          p.date_of_birth,
          ncs.worst_wagner_grade,
          ncs.active_foot_ulcer,
          ncs.worst_retinopathy_grade,
          ncs.dme_present,
          ncs.current_ckd_stage,
          ncs.current_egfr,
          ncs.complication_count,
          ncs.high_risk,
          ncs.last_updated,
          (
            SELECT MAX(dfa.assessment_date)
            FROM diabetic_foot_assessments dfa
            WHERE dfa.patient_id = p.id
          ) AS last_foot_assessment,
          (
            SELECT MAX(rs.screening_date)
            FROM retinopathy_screenings rs
            WHERE rs.patient_id = p.id
          ) AS last_eye_screening,
          (
            SELECT MAX(ckd.record_date)
            FROM ckd_staging_records ckd
            WHERE ckd.patient_id = p.id
          ) AS last_ckd_record
        FROM ncd_complication_summaries ncs
        INNER JOIN patients p ON p.id = ncs.patient_id
        ORDER BY ncs.high_risk DESC, p.last_name ASC, p.first_name ASC
        LIMIT 500
      `,
    );

    return rows.filter((row: any) => {
      if (options.highRiskOnly && !row.high_risk) {
        return false;
      }
      switch (options.complicationType) {
        case 'foot':
          return row.last_foot_assessment || row.worst_wagner_grade !== null;
        case 'eye':
          return row.last_eye_screening || row.worst_retinopathy_grade;
        case 'kidney':
          return row.last_ckd_record || row.current_ckd_stage;
        default:
          return true;
      }
    });
  }
}
