import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Dhis2Service } from './dhis2.service';
import { CdssService } from './cdss.service';
import { PmtctEnrollment } from '../entities/pmtct-enrollment.entity';
import { PmtctInfant } from '../entities/pmtct-infant.entity';
import { PepfarMerIndicator } from '../entities/pepfar-mer-indicator.entity';
import { ArtCohort } from '../entities/art-cohort.entity';

@Injectable()
export class PmtctService {
  private readonly logger = new Logger(PmtctService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly dhis2Service: Dhis2Service,
    private readonly cdssService: CdssService,
  ) {}

  // ── PMTCT Enrollments ─────────────────────────────────────────────────────

  async enrollMother(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PmtctEnrollment);
    const enrollment = repo.create(dto as Partial<PmtctEnrollment>);
    const saved = await repo.save(enrollment) as PmtctEnrollment;
    // Push PMTCT enrollment event to DHIS2 tracker (fire-and-forget)
    this.dhis2Service.sendEvent(
      {
        patientId: saved.patientId,
        program: process.env.DHIS2_PMTCT_PROGRAM_ID || 'MC_PMTCT_TRACKER',
        programStage: 'PMTCT_ENROLLMENT',
        eventDate: saved.enrollmentDate,
        dataValues: [
          { dataElement: 'MC_PMTCT_HIV_STATUS', value: saved.hivStatusAtBooking },
          { dataElement: 'MC_PMTCT_ART_STARTED', value: String(saved.artStarted) },
          { dataElement: 'MC_PMTCT_REGIMEN', value: saved.artRegimen || '' },
        ],
      },
      ds, subdomain,
    ).catch(e => this.logger.warn(`DHIS2 PMTCT enrollment push failed: ${e?.message}`));
    // Push monthly aggregate (fire-and-forget)
    const period = saved.enrollmentDate?.slice(0, 7).replace('-', '') || '';
    if (period) {
      this.dhis2Service.sendAggregateReport(
        { profile: 'pmtct_monthly', period },
        ds, subdomain,
      ).catch(e => this.logger.warn(`DHIS2 PMTCT aggregate push failed: ${e?.message}`));
    }
    return saved;
  }

  async getEnrollment(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PmtctEnrollment).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateEnrollment(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PmtctEnrollment);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── PMTCT Infants ─────────────────────────────────────────────────────────

  async addInfant(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PmtctInfant);
    return repo.save(repo.create(dto));
  }

  async getInfants(subdomain: string, motherPatientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PmtctInfant).find({
      where: { motherPatientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateInfant(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PmtctInfant);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── PEPFAR MER Indicators ─────────────────────────────────────────────────

  async saveMerIndicator(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PepfarMerIndicator);
    return repo.save(repo.create(dto));
  }

  async getMerIndicators(subdomain: string, reportingPeriod?: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const qb = ds.getRepository(PepfarMerIndicator)
      .createQueryBuilder('m')
      .orderBy('m.reporting_period', 'DESC');
    if (reportingPeriod) qb.where('m.reporting_period = :reportingPeriod', { reportingPeriod });
    return qb.getMany();
  }

  async calculateMer(subdomain: string, reportingPeriod: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    // Calculate key PEPFAR MER indicators from existing HIV data
    const raw = await ds.query(`
      SELECT
        (SELECT COUNT(*) FROM hiv_patients WHERE art_status = 'active') AS tx_curr,
        (SELECT COUNT(*) FROM hiv_patients WHERE art_start_date >= date_trunc('quarter', $1::date)
          AND art_start_date < date_trunc('quarter', $1::date) + interval '3 months') AS tx_new
    `, [reportingPeriod.replace('Q', '-')]);
    return raw[0];
  }

  // ── ART Cohorts ───────────────────────────────────────────────────────────

  async saveCohort(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ArtCohort);
    return repo.save(repo.create(dto));
  }

  async getCohorts(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ArtCohort).find({ order: { cohortStartDate: 'DESC' } });
  }

  async updateCohort(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(ArtCohort);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async pmtctRisk(payload: any) {
    try {
      // Route through CdssService (circuit breaker + retry + auth)
      return await this.cdssService.riskAssessment({
        patientId: payload.patient_id || payload.patientId,
        age: payload.age,
        gender: payload.gender,
        vitals: payload.vitals,
        medicalHistory: payload.medical_history || payload.medicalHistory,
        medications: payload.medications,
        diagnoses: payload.diagnoses,
        labResults: payload.lab_results || payload.labResults,
        context: 'pmtct',
        specialty: 'obstetrics',
        module: 'pmtct',
        pmtct: payload,
      });
    } catch (err: any) {
      this.logger.warn(`[PMTCT] CDSS risk assessment unavailable, using local fallback: ${err?.message}`);
      return this.localPmtctRisk(payload);
    }
  }

  async merCalculate(payload: any) {
    try {
      const guidelines = await this.cdssService.getGuidelines('PEPFAR MER indicators PMTCT', {
        ...payload,
        specialty: 'obstetrics',
        module: 'pmtct',
      });
      return { source: 'cdss_guidelines', payload, guidelines };
    } catch (err: any) {
      this.logger.warn(`[PMTCT] CDSS MER calculate unavailable, using local fallback: ${err?.message}`);
      return this.localMerCalculate(payload);
    }
  }

  /** Local PMTCT risk stratification (offline fallback).
   *  Uses WHO/PEPFAR indicators: HIV status, ART adherence, viral load, PMTCT cascade stage.
   */
  private localPmtctRisk(payload: any): Record<string, any> {
    const factors: string[] = [];
    let riskScore = 0;

    const hivPos = payload.hiv_status === 'positive' || payload.hivStatus === 'positive';
    if (hivPos) { riskScore += 3; factors.push('HIV positive'); }

    const onArt = payload.on_art === true || payload.onArt === true;
    if (hivPos && !onArt) { riskScore += 3; factors.push('HIV positive but not on ART'); }

    const vl = Number(payload.viral_load ?? payload.viralLoad ?? -1);
    if (vl > 1000) { riskScore += 3; factors.push(`Unsuppressed viral load (${vl} copies/mL)`); }
    else if (vl > 200) { riskScore += 1; factors.push(`Low-level viraemia (${vl} copies/mL)`); }

    const ga = Number(payload.gestational_age ?? payload.gestationalAge ?? 0);
    if (ga > 36) { riskScore += 1; factors.push('Near term (>36 weeks)'); }

    const lastCD4 = Number(payload.cd4_count ?? payload.cd4Count ?? 999);
    if (lastCD4 < 200) { riskScore += 2; factors.push(`Low CD4 count (${lastCD4})`); }

    if (payload.prior_pregnancy_complications) { riskScore += 1; factors.push('Prior pregnancy complications'); }

    let risk: 'low' | 'moderate' | 'high' = 'low';
    if (riskScore >= 5) risk = 'high';
    else if (riskScore >= 2) risk = 'moderate';

    return {
      source: 'local_fallback',
      risk,
      score: riskScore,
      contributing_factors: factors,
      recommendation: risk === 'high'
        ? 'Urgent multidisciplinary review; ensure viral suppression before delivery'
        : risk === 'moderate'
          ? 'Enhanced monitoring; confirm ART adherence and schedule next VL'
          : 'Continue standard PMTCT protocol',
      guideline_reference: 'WHO PMTCT Consolidated Guidelines 2022 / PEPFAR MER 2.6',
    };
  }

  /** Local MER indicator summary (offline fallback). */
  private localMerCalculate(payload: any): Record<string, any> {
    return {
      source: 'local_fallback',
      message: 'CDSS MER calculation service unavailable. Raw indicators returned for manual review.',
      payload,
      recommended_indicators: ['PMTCT_STAT', 'PMTCT_STAT_POS', 'PMTCT_ART', 'PMTCT_EID', 'PMTCT_HEI_POS'],
      guideline_reference: 'PEPFAR MER 2.6 Indicator Reference Sheet',
    };
  }
}
