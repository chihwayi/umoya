import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

type Module =
  | 'oncology'
  | 'blood_bank'
  | 'radiology'
  | 'dialysis'
  | 'dental'
  | 'aviation'
  | 'oem';

@Injectable()
export class ModuleReportsService {
  constructor(private readonly tenantService: TenantService) {}

  async getModuleReport(tenantId: string, module: Module, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    switch (module) {
      case 'oncology':       return this.oncologyReport(db, tenantId, period);
      case 'blood_bank':     return this.bloodBankReport(db, tenantId, period);
      case 'radiology':      return this.radiologyReport(db, tenantId, period);
      case 'dialysis':       return this.dialysisReport(db, tenantId, period);
      case 'dental':         return this.dentalReport(db, tenantId, period);
      case 'aviation':       return this.aviationReport(db, tenantId, period);
      case 'oem':            return this.oemReport(db, tenantId, period);
      default: return { error: 'Unknown module' };
    }
  }

  async listAvailableModules(): Promise<any[]> {
    return [
      { key: 'oncology',   label: 'Oncology',             icon: 'activity' },
      { key: 'blood_bank', label: 'Blood Bank',           icon: 'droplets' },
      { key: 'radiology',  label: 'Radiology',            icon: 'scan' },
      { key: 'dialysis',   label: 'Dialysis & Nephrology',icon: 'filter' },
      { key: 'dental',     label: 'Dental',               icon: 'smile' },
      { key: 'aviation',   label: 'Aviation Medicine',    icon: 'plane' },
      { key: 'oem',        label: 'Occupational Medicine',icon: 'hard-hat' },
    ];
  }

  private async oncologyReport(db: any, tenantId: string, period: string) {
    const [newCases, activeTreatments, completedChemo, deaths, fiveYearSurv] = await Promise.allSettled([
      db.query(`SELECT COUNT(*)::int AS n FROM oncology_cases WHERE tenant_id=$1 AND TO_CHAR(diagnosis_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM oncology_cases WHERE tenant_id=$1 AND treatment_status='active'`, [tenantId]),
      db.query(`SELECT COUNT(*)::int AS n FROM oncology_treatments WHERE tenant_id=$1 AND treatment_type='chemotherapy' AND TO_CHAR(end_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM oncology_cases WHERE tenant_id=$1 AND outcome='deceased' AND TO_CHAR(outcome_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE outcome='alive') * 100.0 / NULLIF(COUNT(*),0) AS rate
         FROM oncology_cases WHERE tenant_id=$1
           AND diagnosis_date <= NOW() - INTERVAL '5 years'`,
        [tenantId],
      ),
    ]);
    return {
      module: 'oncology', period,
      new_cancer_cases: this.val(newCases),
      active_treatments: this.val(activeTreatments),
      chemotherapy_cycles_completed: this.val(completedChemo),
      cancer_deaths: this.val(deaths),
      five_year_survival_rate_pct: this.rate(fiveYearSurv),
      generated_at: new Date().toISOString(),
    };
  }

  private async bloodBankReport(db: any, tenantId: string, period: string) {
    const [units, transfusions, reactions, wastage, crossmatches] = await Promise.allSettled([
      db.query(`SELECT SUM(units_donated)::int AS n FROM blood_donations WHERE tenant_id=$1 AND TO_CHAR(donation_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM blood_transfusions WHERE tenant_id=$1 AND TO_CHAR(transfusion_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM blood_transfusion_reactions WHERE tenant_id=$1 AND TO_CHAR(reaction_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM blood_units WHERE tenant_id=$1 AND status='expired'  AND TO_CHAR(expiry_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM blood_crossmatches WHERE tenant_id=$1 AND TO_CHAR(performed_at,'YYYYMM')=$2`, [tenantId, period]),
    ]);
    const u = this.val(units);
    const w = this.val(wastage);
    const wastagePct = u > 0 ? Number((w / u * 100).toFixed(1)) : 0;
    return {
      module: 'blood_bank', period,
      units_donated: u,
      transfusions_performed: this.val(transfusions),
      transfusion_reactions: this.val(reactions),
      units_expired_wastage: w,
      wastage_pct: wastagePct,
      crossmatches: this.val(crossmatches),
      generated_at: new Date().toISOString(),
    };
  }

  private async radiologyReport(db: any, tenantId: string, period: string) {
    const [total, critical, pending, avgTat, modalities] = await Promise.allSettled([
      db.query(`SELECT COUNT(*)::int AS n FROM imaging_orders WHERE tenant_id=$1 AND TO_CHAR(ordered_at,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM imaging_orders WHERE tenant_id=$1 AND critical_flag=true AND TO_CHAR(ordered_at,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM imaging_orders WHERE tenant_id=$1 AND status='pending'`, [tenantId]),
      db.query(
        `SELECT AVG(EXTRACT(HOUR FROM (reported_at - ordered_at))) AS hrs
         FROM imaging_orders WHERE tenant_id=$1 AND reported_at IS NOT NULL AND TO_CHAR(ordered_at,'YYYYMM')=$2`,
        [tenantId, period],
      ),
      db.query(
        `SELECT modality, COUNT(*)::int AS n FROM imaging_orders
         WHERE tenant_id=$1 AND TO_CHAR(ordered_at,'YYYYMM')=$2 GROUP BY modality ORDER BY n DESC`,
        [tenantId, period],
      ),
    ]);
    return {
      module: 'radiology', period,
      total_studies: this.val(total),
      critical_findings: this.val(critical),
      studies_pending_report: this.val(pending),
      avg_report_tat_hours: this.numFirst(avgTat, 'hrs'),
      by_modality: this.rows(modalities),
      generated_at: new Date().toISOString(),
    };
  }

  private async dialysisReport(db: any, tenantId: string, period: string) {
    const [sessions, activePatients, avgKtV, adequacy, access] = await Promise.allSettled([
      db.query(`SELECT COUNT(*)::int AS n FROM dialysis_sessions WHERE tenant_id=$1 AND TO_CHAR(session_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(DISTINCT patient_id)::int AS n FROM dialysis_sessions WHERE tenant_id=$1 AND TO_CHAR(session_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT AVG(kt_v) AS v FROM dialysis_sessions WHERE tenant_id=$1 AND kt_v IS NOT NULL AND TO_CHAR(session_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE kt_v >= 1.2)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE kt_v IS NOT NULL),0) AS rate
         FROM dialysis_sessions WHERE tenant_id=$1 AND TO_CHAR(session_date,'YYYYMM')=$2`,
        [tenantId, period],
      ),
      db.query(
        `SELECT access_type, COUNT(*)::int AS n FROM dialysis_sessions
         WHERE tenant_id=$1 AND TO_CHAR(session_date,'YYYYMM')=$2 GROUP BY access_type`,
        [tenantId, period],
      ),
    ]);
    return {
      module: 'dialysis', period,
      total_sessions: this.val(sessions),
      active_patients: this.val(activePatients),
      avg_kt_v: this.numFirst(avgKtV, 'v'),
      dialysis_adequacy_rate_pct: this.rate(adequacy),
      by_access_type: this.rows(access),
      generated_at: new Date().toISOString(),
    };
  }

  private async dentalReport(db: any, tenantId: string, period: string) {
    const [visits, extractions, fillings, dentures, referrals] = await Promise.allSettled([
      db.query(`SELECT COUNT(*)::int AS n FROM dental_appointments WHERE tenant_id=$1 AND status='completed' AND TO_CHAR(appointment_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM dental_procedures WHERE tenant_id=$1 AND procedure_type='extraction' AND TO_CHAR(performed_at,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM dental_procedures WHERE tenant_id=$1 AND procedure_type IN ('filling','composite') AND TO_CHAR(performed_at,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM dental_procedures WHERE tenant_id=$1 AND procedure_type ILIKE '%denture%' AND TO_CHAR(performed_at,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM dental_referrals WHERE tenant_id=$1 AND TO_CHAR(referral_date,'YYYYMM')=$2`, [tenantId, period]),
    ]);
    return {
      module: 'dental', period,
      completed_visits: this.val(visits),
      extractions: this.val(extractions),
      fillings: this.val(fillings),
      dentures: this.val(dentures),
      specialist_referrals: this.val(referrals),
      generated_at: new Date().toISOString(),
    };
  }

  private async aviationReport(db: any, tenantId: string, period: string) {
    const [exams, fit, restricted, unfit, class1] = await Promise.allSettled([
      db.query(`SELECT COUNT(*)::int AS n FROM aviation_medical_exams WHERE tenant_id=$1 AND TO_CHAR(exam_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM aviation_medical_exams WHERE tenant_id=$1 AND outcome='fit' AND TO_CHAR(exam_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM aviation_medical_exams WHERE tenant_id=$1 AND outcome='fit_with_restriction' AND TO_CHAR(exam_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM aviation_medical_exams WHERE tenant_id=$1 AND outcome='unfit' AND TO_CHAR(exam_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM aviation_medical_exams WHERE tenant_id=$1 AND certificate_class='class_1' AND TO_CHAR(exam_date,'YYYYMM')=$2`, [tenantId, period]),
    ]);
    const total = this.val(exams);
    const fitCount = this.val(fit);
    return {
      module: 'aviation', period,
      total_medical_exams: total,
      fit_for_duty: fitCount,
      fit_with_restriction: this.val(restricted),
      unfit: this.val(unfit),
      fitness_rate_pct: total > 0 ? Number(((fitCount / total) * 100).toFixed(1)) : 0,
      class_1_certificates: this.val(class1),
      generated_at: new Date().toISOString(),
    };
  }

  private async oemReport(db: any, tenantId: string, period: string) {
    const [assessments, injuries, workRelated, ltCases, hazardExposures] = await Promise.allSettled([
      db.query(`SELECT COUNT(*)::int AS n FROM oem_assessments WHERE tenant_id=$1 AND TO_CHAR(assessment_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM oem_injuries WHERE tenant_id=$1 AND TO_CHAR(injury_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM oem_injuries WHERE tenant_id=$1 AND work_related=true AND TO_CHAR(injury_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(*)::int AS n FROM oem_injuries WHERE tenant_id=$1 AND lost_time_days > 0 AND TO_CHAR(injury_date,'YYYYMM')=$2`, [tenantId, period]),
      db.query(`SELECT COUNT(DISTINCT worker_id)::int AS n FROM oem_hazard_exposures WHERE tenant_id=$1 AND TO_CHAR(recorded_at,'YYYYMM')=$2`, [tenantId, period]),
    ]);
    return {
      module: 'oem', period,
      pre_employment_assessments: this.val(assessments),
      total_injuries: this.val(injuries),
      work_related_injuries: this.val(workRelated),
      lost_time_cases: this.val(ltCases),
      workers_with_hazard_exposures: this.val(hazardExposures),
      generated_at: new Date().toISOString(),
    };
  }

  private val(settled: PromiseSettledResult<any>): number {
    if (settled.status !== 'fulfilled' || !settled.value?.length) return 0;
    const row = settled.value[0];
    return Number(row?.n ?? row?.total ?? 0);
  }

  private rate(settled: PromiseSettledResult<any>): number {
    if (settled.status !== 'fulfilled' || !settled.value?.length) return 0;
    const row = settled.value[0];
    const v = Number(row?.rate ?? row?.rate_pct ?? 0);
    return isNaN(v) ? 0 : Number((v * (v <= 1 ? 100 : 1)).toFixed(1));
  }

  private numFirst(settled: PromiseSettledResult<any>, key: string): number {
    if (settled.status !== 'fulfilled' || !settled.value?.length) return 0;
    return Number(settled.value[0]?.[key] ?? 0);
  }

  private rows(settled: PromiseSettledResult<any>): any[] {
    if (settled.status !== 'fulfilled') return [];
    return settled.value ?? [];
  }
}
