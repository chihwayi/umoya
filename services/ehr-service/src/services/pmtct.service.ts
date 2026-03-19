import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Dhis2Service } from './dhis2.service';
import { PmtctEnrollment } from '../entities/pmtct-enrollment.entity';
import { PmtctInfant } from '../entities/pmtct-infant.entity';
import { PepfarMerIndicator } from '../entities/pepfar-mer-indicator.entity';
import { ArtCohort } from '../entities/art-cohort.entity';
import axios from 'axios';

@Injectable()
export class PmtctService {
  private readonly logger = new Logger(PmtctService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly dhis2Service: Dhis2Service,
  ) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── PMTCT Enrollments ─────────────────────────────────────────────────────

  async enrollMother(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PmtctEnrollment);
    const saved = await repo.save(repo.create(dto));
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
    const { data } = await axios.post(`${this.cdssUrl}/hiv/pmtct/risk`, payload);
    return data;
  }

  async merCalculate(payload: any) {
    const { data } = await axios.post(`${this.cdssUrl}/hiv/mer/calculate`, payload);
    return data;
  }
}
