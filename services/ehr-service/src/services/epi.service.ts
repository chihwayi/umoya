import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { EpiSchedule } from '../entities/epi-schedule.entity';
import { ImmunizationRecord } from '../entities/immunization-record.entity';
import { VaccineLot } from '../entities/vaccine-lot.entity';
import { ColdChainLog } from '../entities/cold-chain-log.entity';
import { AefiReport } from '../entities/aefi-report.entity';
import { Dhis2TrackerSyncLog } from '../entities/dhis2-tracker-sync-log.entity';

@Injectable()
export class EpiService {
  private readonly logger = new Logger(EpiService.name);

  constructor(private readonly tenantService: TenantService) {}

  // ── Repository helpers ─────────────────────────────────────────────────────

  private async scheduleRepo(tenantId: string): Promise<Repository<EpiSchedule>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(EpiSchedule);
  }

  private async recordRepo(tenantId: string): Promise<Repository<ImmunizationRecord>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ImmunizationRecord);
  }

  private async lotRepo(tenantId: string): Promise<Repository<VaccineLot>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(VaccineLot);
  }

  private async coldChainRepo(tenantId: string): Promise<Repository<ColdChainLog>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ColdChainLog);
  }

  private async aefiRepo(tenantId: string): Promise<Repository<AefiReport>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(AefiReport);
  }

  private async syncLogRepo(tenantId: string): Promise<Repository<Dhis2TrackerSyncLog>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(Dhis2TrackerSyncLog);
  }

  // ── Immunization records ───────────────────────────────────────────────────

  async recordDose(
    tenantId: string,
    userId: string,
    body: {
      patientId: string;
      epiScheduleId?: string;
      vaccineName: string;
      doseNumber: number;
      lotNumber?: string;
      manufacturer?: string;
      expiryDate?: string;
      administeredAt: string;
      site?: string;
      route?: string;
      doseMl?: number;
      facilityId?: string;
      status?: 'given' | 'missed' | 'contraindicated';
      contraindicationReason?: string;
      notes?: string;
    },
  ): Promise<ImmunizationRecord> {
    const repo = await this.recordRepo(tenantId);
    const record = repo.create({
      ...body,
      administeredAt: new Date(body.administeredAt),
      administeredBy: userId,
      status: body.status ?? 'given',
    });
    const saved = await repo.save(record);

    if (body.lotNumber) {
      await this.decrementLotQuantity(tenantId, body.lotNumber);
    }
    return saved;
  }

  async getPatientRecords(tenantId: string, patientId: string): Promise<ImmunizationRecord[]> {
    const repo = await this.recordRepo(tenantId);
    return repo.find({ where: { patientId }, order: { administeredAt: 'DESC' } });
  }

  // ── EPI schedule: upcoming doses for a patient ─────────────────────────────

  async getPatientSchedule(
    tenantId: string,
    patientId: string,
    dateOfBirth: string,
    countryCode: string,
  ): Promise<
    Array<{
      schedule: EpiSchedule;
      dueDate: string;
      status: 'due' | 'upcoming' | 'given' | 'overdue';
    }>
  > {
    const sr = await this.scheduleRepo(tenantId);
    const rr = await this.recordRepo(tenantId);

    const schedules = await sr.find({ where: { countryCode, isActive: true }, order: { dueAgeDays: 'ASC' } });
    const records = await rr.find({ where: { patientId, status: 'given' } });
    const givenScheduleIds = new Set(records.map((r) => r.epiScheduleId).filter(Boolean));

    const dob = new Date(dateOfBirth);
    const today = new Date();

    return schedules.map((schedule) => {
      const dueDate = new Date(dob);
      dueDate.setDate(dob.getDate() + schedule.dueAgeDays);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      let status: 'due' | 'upcoming' | 'given' | 'overdue';
      if (givenScheduleIds.has(schedule.id)) {
        status = 'given';
      } else if (dueDate < today) {
        status = 'overdue';
      } else {
        const windowStart = new Date(dueDate);
        windowStart.setDate(dueDate.getDate() - schedule.windowEarlyDays);
        status = windowStart <= today ? 'due' : 'upcoming';
      }

      return { schedule, dueDate: dueDateStr, status };
    });
  }

  // ── Defaulter list ─────────────────────────────────────────────────────────

  async getDefaulters(
    tenantId: string,
    facilityId?: string,
    countryCode?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const offset = (page - 1) * limit;

    const params: any[] = [];
    let pi = 1;

    const ccFilter = countryCode ? `AND s.country_code = $${pi++}` : '';
    if (countryCode) params.push(countryCode);

    const facFilter = facilityId ? `AND p.facility_id = $${pi++}` : '';
    if (facilityId) params.push(facilityId);

    params.push(limit, offset);

    const sql = `
      SELECT
        p.id AS patient_id,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.phone,
        s.vaccine_name,
        s.dose_number,
        (p.date_of_birth::date + (s.due_age_days || ' days')::interval)::date AS due_date,
        (NOW()::date - (p.date_of_birth::date + (s.due_age_days || ' days')::interval)::date)::int AS days_overdue
      FROM patients p
      CROSS JOIN epi_schedules s
      LEFT JOIN immunization_records ir
        ON ir.patient_id = p.id
        AND ir.epi_schedule_id = s.id
        AND ir.status = 'given'
      WHERE s.is_active = true
        AND ir.id IS NULL
        AND p.date_of_birth IS NOT NULL
        AND (p.date_of_birth::date + (s.due_age_days || ' days')::interval)::date < NOW()::date
        ${ccFilter}
        ${facFilter}
      ORDER BY days_overdue DESC
      LIMIT $${pi++} OFFSET $${pi++}
    `;

    try {
      const data = await db.query(sql, params);
      return { data, total: data.length, page, limit };
    } catch (e) {
      this.logger.error(`Defaulter query failed: ${e instanceof Error ? e.message : e}`);
      return { data: [], total: 0, page, limit };
    }
  }

  // ── AEFI ───────────────────────────────────────────────────────────────────

  async reportAefi(
    tenantId: string,
    userId: string,
    body: {
      patientId: string;
      immunizationRecordId?: string;
      eventType: string;
      onsetDate: string;
      severity: 'mild' | 'moderate' | 'severe' | 'fatal';
      outcome?: string;
      description: string;
      hospitalized?: boolean;
      reportedToMoh?: boolean;
      mohReference?: string;
    },
  ): Promise<AefiReport> {
    const repo = await this.aefiRepo(tenantId);
    const report = repo.create({ ...body, reportedBy: userId });
    return repo.save(report);
  }

  async getPatientAefi(tenantId: string, patientId: string): Promise<AefiReport[]> {
    const repo = await this.aefiRepo(tenantId);
    return repo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  // ── Vaccine lots ───────────────────────────────────────────────────────────

  async getLots(tenantId: string, activeOnly = true): Promise<VaccineLot[]> {
    const repo = await this.lotRepo(tenantId);
    return repo.find({ where: activeOnly ? { isActive: true } : {}, order: { expiryDate: 'ASC' } });
  }

  async addLot(tenantId: string, body: Partial<VaccineLot>): Promise<VaccineLot> {
    const repo = await this.lotRepo(tenantId);
    const lot = repo.create(body);
    return repo.save(lot);
  }

  private async decrementLotQuantity(tenantId: string, lotNumber: string): Promise<void> {
    const repo = await this.lotRepo(tenantId);
    const lot = await repo.findOne({ where: { lotNumber, isActive: true } });
    if (lot && lot.quantityRemaining > 0) {
      lot.quantityRemaining -= 1;
      if (lot.quantityRemaining === 0) lot.isActive = false;
      await repo.save(lot);
    }
  }

  // ── Cold chain ─────────────────────────────────────────────────────────────

  async recordTemperature(
    tenantId: string,
    userId: string,
    body: {
      vaccineLotId?: string;
      storageLocation: string;
      temperatureCelsius: number;
      recordedAt: string;
      excursionAction?: string;
    },
  ): Promise<ColdChainLog> {
    const repo = await this.coldChainRepo(tenantId);

    let minTemp = 2.0;
    let maxTemp = 8.0;

    if (body.vaccineLotId) {
      const lr = await this.lotRepo(tenantId);
      const lot = await lr.findOne({ where: { id: body.vaccineLotId } });
      if (lot) {
        minTemp = Number(lot.minTempCelsius);
        maxTemp = Number(lot.maxTempCelsius);
      }
    }

    const excursionDetected = body.temperatureCelsius < minTemp || body.temperatureCelsius > maxTemp;
    const log = repo.create({
      ...body,
      recordedAt: new Date(body.recordedAt),
      recordedBy: userId,
      excursionDetected,
    });
    return repo.save(log);
  }

  async getColdChainExcursions(tenantId: string, days = 30): Promise<ColdChainLog[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ColdChainLog);
    const since = new Date();
    since.setDate(since.getDate() - days);
    return repo
      .createQueryBuilder('ccl')
      .where('ccl.excursion_detected = true')
      .andWhere('ccl.recorded_at >= :since', { since })
      .orderBy('ccl.recorded_at', 'DESC')
      .getMany();
  }

  // ── Coverage rate ──────────────────────────────────────────────────────────

  async getCoverageRate(
    tenantId: string,
    facilityId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<Array<{ vaccineName: string; doseNumber: number; given: number }>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const from = fromDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = toDate ?? new Date().toISOString().split('T')[0];
    const params: any[] = [from, to];
    const facFilter = facilityId ? `AND ir.facility_id = $3` : '';
    if (facilityId) params.push(facilityId);

    const rows: any[] = await db.query(
      `SELECT ir.vaccine_name, ir.dose_number, COUNT(*)::int AS given
       FROM immunization_records ir
       WHERE ir.status = 'given'
         AND ir.administered_at::date BETWEEN $1 AND $2
         ${facFilter}
       GROUP BY ir.vaccine_name, ir.dose_number
       ORDER BY ir.vaccine_name, ir.dose_number`,
      params,
    );

    return rows.map((r) => ({
      vaccineName: r.vaccine_name,
      doseNumber: Number(r.dose_number),
      given: Number(r.given),
    }));
  }

  // ── DHIS2 sync log ─────────────────────────────────────────────────────────

  async getSyncStatus(tenantId: string, entityId: string): Promise<Dhis2TrackerSyncLog | null> {
    const repo = await this.syncLogRepo(tenantId);
    return repo.findOne({ where: { entityId }, order: { createdAt: 'DESC' } });
  }

  async upsertSyncLog(tenantId: string, data: Partial<Dhis2TrackerSyncLog>): Promise<Dhis2TrackerSyncLog> {
    const repo = await this.syncLogRepo(tenantId);
    const existing = data.entityId
      ? await repo.findOne({ where: { entityType: data.entityType, entityId: data.entityId } })
      : null;
    if (existing) {
      Object.assign(existing, data);
      return repo.save(existing);
    }
    const entry = repo.create(data);
    return repo.save(entry);
  }

  async getPendingSyncRecords(tenantId: string): Promise<Dhis2TrackerSyncLog[]> {
    const repo = await this.syncLogRepo(tenantId);
    return repo.find({ where: { syncStatus: 'pending' }, order: { createdAt: 'ASC' } });
  }
}
