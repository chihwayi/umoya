import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { NotifiableDisease } from '../entities/notifiable-disease.entity';
import { OutbreakCase } from '../entities/outbreak-case.entity';
import { ContactTrace } from '../entities/contact-trace.entity';
import { MohAlert } from '../entities/moh-alert.entity';

@Injectable()
export class OutbreakService {
  constructor(private tenantService: TenantService) {}

  // ── Notifiable diseases ───────────────────────────────────────────────────

  async getNotifiableDiseases(tenantId: string, countryCode?: string): Promise<NotifiableDisease[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NotifiableDisease);
    const where: any = { isActive: true };
    if (countryCode) where.countryCode = countryCode;
    return repo.find({ where, order: { diseaseName: 'ASC' } });
  }

  async upsertNotifiableDisease(tenantId: string, body: any): Promise<NotifiableDisease> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NotifiableDisease);
    if (body.id) {
      await repo.update(body.id, body);
      return repo.findOne({ where: { id: body.id } }) as Promise<NotifiableDisease>;
    }
    const entity = repo.create(body);
    return repo.save(entity) as unknown as Promise<NotifiableDisease>;
  }

  // ── Outbreak cases ────────────────────────────────────────────────────────

  async registerCase(tenantId: string, userId: string, body: any): Promise<OutbreakCase> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OutbreakCase);
    const entity = repo.create({ ...body, reportedBy: userId });
    const saved = (await repo.save(entity)) as unknown as OutbreakCase;

    // Threshold check — async, non-blocking
    this.checkThreshold(tenantId, saved).catch(() => {});

    return saved;
  }

  async getCases(
    tenantId: string,
    filters: { diseaseId?: string; status?: string; from?: string; to?: string; page: number; limit: number },
  ): Promise<{ data: OutbreakCase[]; total: number; page: number; limit: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OutbreakCase);

    const qb = repo.createQueryBuilder('c').orderBy('c.createdAt', 'DESC');
    if (filters.diseaseId) qb.andWhere('c.notifiableDiseaseId = :did', { did: filters.diseaseId });
    if (filters.status) qb.andWhere('c.status = :status', { status: filters.status });
    if (filters.from) qb.andWhere('c.diagnosisDate >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('c.diagnosisDate <= :to', { to: filters.to });

    const total = await qb.getCount();
    const data = await qb
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getMany();
    return { data, total, page: filters.page, limit: filters.limit };
  }

  async updateCase(tenantId: string, id: string, body: any): Promise<OutbreakCase | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OutbreakCase);
    await repo.update(id, body);
    return repo.findOne({ where: { id } });
  }

  // ── Epidemic curve & dashboard ────────────────────────────────────────────

  async getDashboard(tenantId: string, countryCode?: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    // Epidemic curve: case counts per day for last 30 days
    const curveRows: { day: string; count: string }[] = await db.query(
      `SELECT DATE(diagnosis_date) AS day, COUNT(*) AS count
       FROM outbreak_cases
       WHERE diagnosis_date >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(diagnosis_date)
       ORDER BY day ASC`,
    );

    // Active alerts
    const alertRepo = db.getRepository(MohAlert);
    const activeAlerts = await alertRepo.find({
      where: { acknowledged: false },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Case counts by status
    const statusRows: { status: string; count: string }[] = await db.query(
      `SELECT status, COUNT(*) AS count FROM outbreak_cases GROUP BY status`,
    );

    return {
      epidemicCurve: curveRows.map((r) => ({ day: r.day, count: Number(r.count) })),
      activeAlerts,
      casesByStatus: Object.fromEntries(statusRows.map((r) => [r.status, Number(r.count)])),
    };
  }

  // ── Contact tracing ───────────────────────────────────────────────────────

  async addContact(tenantId: string, caseId: string, body: any): Promise<ContactTrace> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ContactTrace);
    const entity = repo.create({ ...body, indexCaseId: caseId });
    return repo.save(entity) as unknown as Promise<ContactTrace>;
  }

  async getContacts(tenantId: string, caseId: string): Promise<ContactTrace[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ContactTrace).find({
      where: { indexCaseId: caseId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateContactFollowUp(tenantId: string, contactId: string, body: any): Promise<ContactTrace | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ContactTrace);
    await repo.update(contactId, body);
    return repo.findOne({ where: { id: contactId } });
  }

  // ── MOH alerts ───────────────────────────────────────────────────────────

  async getAlerts(tenantId: string): Promise<MohAlert[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MohAlert).find({ order: { createdAt: 'DESC' } });
  }

  async acknowledgeAlert(tenantId: string, alertId: string): Promise<MohAlert | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MohAlert);
    await repo.update(alertId, { acknowledged: true });
    return repo.findOne({ where: { id: alertId } });
  }

  // ── SORMAS sync ───────────────────────────────────────────────────────────

  async storeSormasUuid(tenantId: string, caseId: string, sormasCaseUuid: string): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.getRepository(OutbreakCase).update(caseId, { sormasCaseUuid, reportedToMoh: true });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async checkThreshold(tenantId: string, outbreakCase: OutbreakCase): Promise<void> {
    if (!outbreakCase.notifiableDiseaseId) return;

    const db = await this.tenantService.getTenantDatabase(tenantId);
    const diseaseRepo = db.getRepository(NotifiableDisease);
    const alertRepo = db.getRepository(MohAlert);

    const disease = await diseaseRepo.findOne({ where: { id: outbreakCase.notifiableDiseaseId } });
    if (!disease) return;

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - disease.alertWindowDays);
    const windowStartStr = windowStart.toISOString().slice(0, 10);
    const windowEndStr = new Date().toISOString().slice(0, 10);

    const [{ count }]: { count: string }[] = await db.query(
      `SELECT COUNT(*) AS count FROM outbreak_cases
       WHERE notifiable_disease_id = $1 AND diagnosis_date >= $2`,
      [disease.id, windowStartStr],
    );

    if (Number(count) >= disease.alertThreshold) {
      // Check if alert already fired for this window to avoid duplicates
      const existing = await alertRepo.findOne({
        where: {
          notifiableDiseaseId: disease.id,
          windowStart: windowStartStr,
          windowEnd: windowEndStr,
        },
      });
      if (existing) return;

      const alert = alertRepo.create({
        notifiableDiseaseId: disease.id,
        alertType: 'threshold',
        caseCount: Number(count),
        windowStart: windowStartStr,
        windowEnd: windowEndStr,
        alertSentAt: new Date(),
        acknowledged: false,
      });
      await alertRepo.save(alert);
    }
  }
}
