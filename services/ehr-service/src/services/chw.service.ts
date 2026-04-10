import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { Household } from '../entities/household.entity';
import { HouseholdMember } from '../entities/household-member.entity';
import { ChwVisit } from '../entities/chw-visit.entity';
import { ChwTask } from '../entities/chw-task.entity';
import { ChwDailyTally } from '../entities/chw-daily-tally.entity';
import { Patient } from '../entities/patient.entity';

interface HouseholdFilters {
  chwId?: string;
  village?: string;
  ward?: string;
  page?: number;
  limit?: number;
}

interface VisitFilters {
  chwId?: string;
  householdId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface BatchSyncPayload {
  visits?: Array<Record<string, any>>;
  tallies?: Array<Record<string, any>>;
  taskCompletions?: Array<{ id: string; notes?: string | null }>;
}

@Injectable()
export class ChwService {
  constructor(private readonly tenantService: TenantService) {}

  private classifyMuac(muacMm?: number | null): string | null {
    if (muacMm == null || Number.isNaN(Number(muacMm))) {
      return null;
    }
    const value = Number(muacMm);
    if (value < 115) return 'SAM';
    if (value <= 124) return 'MAM';
    return 'normal';
  }

  private async getDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) {
      throw new BadRequestException('Invalid tenant');
    }
    return db;
  }

  private page(value?: number, fallback = 1): number {
    return Math.max(1, Number(value) || fallback);
  }

  private limit(value?: number, fallback = 20): number {
    return Math.max(1, Math.min(200, Number(value) || fallback));
  }

  private householdRepo(db: DataSource): Repository<Household> {
    return db.getRepository(Household);
  }

  private memberRepo(db: DataSource): Repository<HouseholdMember> {
    return db.getRepository(HouseholdMember);
  }

  private visitRepo(db: DataSource): Repository<ChwVisit> {
    return db.getRepository(ChwVisit);
  }

  private taskRepo(db: DataSource): Repository<ChwTask> {
    return db.getRepository(ChwTask);
  }

  private tallyRepo(db: DataSource): Repository<ChwDailyTally> {
    return db.getRepository(ChwDailyTally);
  }

  async registerHousehold(tenantId: string, body: Record<string, any>): Promise<Household> {
    const db = await this.getDb(tenantId);
    const repo = this.householdRepo(db);
    const household = repo.create({
      householdCode: body.householdCode,
      headOfHousehold: body.headOfHousehold ?? null,
      address: body.address ?? null,
      village: body.village ?? null,
      ward: body.ward ?? null,
      district: body.district ?? null,
      gpsLat: body.gpsLat ?? null,
      gpsLng: body.gpsLng ?? null,
      waterSource: body.waterSource ?? null,
      sanitationType: body.sanitationType ?? null,
      assignedChwId: body.assignedChwId ?? null,
    });
    return repo.save(household);
  }

  async getHouseholds(tenantId: string, filters: HouseholdFilters) {
    const db = await this.getDb(tenantId);
    const page = this.page(filters.page);
    const limit = this.limit(filters.limit);
    const offset = (page - 1) * limit;
    const repo = this.householdRepo(db);

    const qb = repo
      .createQueryBuilder('h')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from(HouseholdMember, 'hm')
          .where('hm.household_id = h.id');
      }, 'member_count')
      .orderBy('h.created_at', 'DESC');

    if (filters.chwId) {
      qb.andWhere('h.assigned_chw_id = :chwId', { chwId: filters.chwId });
    }
    if (filters.village) {
      qb.andWhere('h.village ILIKE :village', { village: `%${filters.village}%` });
    }
    if (filters.ward) {
      qb.andWhere('h.ward ILIKE :ward', { ward: `%${filters.ward}%` });
    }

    const total = await qb.getCount();
    const { entities, raw } = await qb.take(limit).skip(offset).getRawAndEntities();
    const data = entities.map((household, index) => ({
      ...household,
      memberCount: Number(raw[index]?.member_count ?? 0),
    }));

    return { data, total, page, limit };
  }

  async getHouseholdDetail(tenantId: string, id: string) {
    const db = await this.getDb(tenantId);
    const household = await this.householdRepo(db).findOne({ where: { id } });
    if (!household) {
      throw new NotFoundException('Household not found');
    }

    const [members, recentVisits, openTasks] = await Promise.all([
      this.memberRepo(db).find({ where: { householdId: id }, order: { createdAt: 'ASC' } }),
      this.visitRepo(db).find({
        where: { householdId: id },
        order: { visitDate: 'DESC', createdAt: 'DESC' },
        take: 10,
      }),
      this.taskRepo(db).find({
        where: { householdId: id, status: 'pending' },
        order: { dueDate: 'ASC', createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    return { household, members, recentVisits, openTasks };
  }

  async addMember(tenantId: string, householdId: string, body: Record<string, any>): Promise<HouseholdMember> {
    const db = await this.getDb(tenantId);
    const household = await this.householdRepo(db).findOne({ where: { id: householdId } });
    if (!household) {
      throw new NotFoundException('Household not found');
    }
    const repo = this.memberRepo(db);
    const member = repo.create({
      householdId,
      patientId: body.patientId ?? null,
      memberName: body.memberName,
      dateOfBirth: body.dateOfBirth ?? null,
      sex: body.sex ?? null,
      relationship: body.relationship ?? null,
    });
    return repo.save(member);
  }

  private async saveVisit(db: DataSource, userId: string, body: Record<string, any>, synced: boolean): Promise<ChwVisit> {
    const chwId = body.chwId || userId;
    if (!chwId) {
      throw new BadRequestException('CHW ID is required to record a visit');
    }
    const repo = this.visitRepo(db);
    const visit = repo.create({
      chwId,
      householdId: body.householdId ?? null,
      patientId: body.patientId ?? null,
      visitDate: body.visitDate,
      visitType: body.visitType,
      muacMm: body.muacMm ?? null,
      muacClassification: this.classifyMuac(body.muacMm),
      weightKg: body.weightKg ?? null,
      heightCm: body.heightCm ?? null,
      temperatureCelsius: body.temperatureCelsius ?? null,
      referredToFacility: Boolean(body.referredToFacility),
      referralReason: body.referralReason ?? null,
      servicesProvided: Array.isArray(body.servicesProvided) ? body.servicesProvided : null,
      notes: body.notes ?? null,
      gpsLat: body.gpsLat ?? null,
      gpsLng: body.gpsLng ?? null,
      synced,
    });
    return repo.save(visit);
  }

  async recordVisit(tenantId: string, userId: string, body: Record<string, any>): Promise<ChwVisit> {
    const db = await this.getDb(tenantId);
    return this.saveVisit(db, userId, body, Boolean(body.synced));
  }

  async getVisits(tenantId: string, filters: VisitFilters) {
    const db = await this.getDb(tenantId);
    const page = this.page(filters.page);
    const limit = this.limit(filters.limit);
    const offset = (page - 1) * limit;
    const repo = this.visitRepo(db);

    const qb = repo
      .createQueryBuilder('v')
      .leftJoin(Household, 'h', 'h.id = v.household_id')
      .addSelect('h.household_code', 'household_code')
      .orderBy('v.visit_date', 'DESC')
      .addOrderBy('v.created_at', 'DESC');

    if (filters.chwId) {
      qb.andWhere('v.chw_id = :chwId', { chwId: filters.chwId });
    }
    if (filters.householdId) {
      qb.andWhere('v.household_id = :householdId', { householdId: filters.householdId });
    }
    if (filters.from) {
      qb.andWhere('v.visit_date >= :fromDate', { fromDate: filters.from });
    }
    if (filters.to) {
      qb.andWhere('v.visit_date <= :toDate', { toDate: filters.to });
    }

    const total = await qb.getCount();
    const { entities, raw } = await qb.take(limit).skip(offset).getRawAndEntities();
    const data = entities.map((visit, index) => ({
      ...visit,
      householdCode: raw[index]?.household_code ?? null,
    }));

    return { data, total, page, limit };
  }

  async getTasks(tenantId: string, chwId?: string, status?: string) {
    const db = await this.getDb(tenantId);
    const repo = this.taskRepo(db);
    const qb = repo
      .createQueryBuilder('t')
      .leftJoin(Household, 'h', 'h.id = t.household_id')
      .leftJoin(Patient, 'p', 'p.id = t.patient_id')
      .addSelect('h.household_code', 'household_code')
      .addSelect("TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))", 'patient_name')
      .orderBy('t.due_date', 'ASC')
      .addOrderBy('t.created_at', 'DESC');

    if (chwId) {
      qb.andWhere('t.assigned_to_chw_id = :chwId', { chwId });
    }
    if (status && status !== 'all') {
      qb.andWhere('t.status = :status', { status });
    }

    const { entities, raw } = await qb.getRawAndEntities();
    return entities.map((task, index) => ({
      ...task,
      householdCode: raw[index]?.household_code ?? null,
      patientName: (raw[index]?.patient_name || '').trim() || null,
      overdue: task.status !== 'completed' && task.dueDate < new Date().toISOString().slice(0, 10),
    }));
  }

  async assignTask(tenantId: string, body: Record<string, any>, assignedBy: string): Promise<ChwTask> {
    const db = await this.getDb(tenantId);
    const repo = this.taskRepo(db);
    const task = repo.create({
      assignedToChwId: body.assignedToChwId,
      patientId: body.patientId ?? null,
      householdId: body.householdId ?? null,
      taskType: body.taskType,
      dueDate: body.dueDate,
      priority: body.priority ?? 'normal',
      instructions: body.instructions ?? null,
      status: body.status ?? 'pending',
      assignedBy: assignedBy ?? body.assignedBy ?? null,
    });
    return repo.save(task);
  }

  async completeTask(tenantId: string, taskId: string, notes?: string | null): Promise<ChwTask> {
    const db = await this.getDb(tenantId);
    const repo = this.taskRepo(db);
    const task = await repo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('CHW task not found');
    }
    task.status = 'completed';
    task.completedAt = new Date();
    task.completionNotes = notes ?? null;
    return repo.save(task);
  }

  async getDailyTally(tenantId: string, chwId: string, date: string): Promise<ChwDailyTally | null> {
    const db = await this.getDb(tenantId);
    return this.tallyRepo(db).findOne({ where: { chwId, tallyDate: date } });
  }

  async submitTally(tenantId: string, body: Record<string, any>): Promise<ChwDailyTally> {
    const db = await this.getDb(tenantId);
    const repo = this.tallyRepo(db);
    let tally = await repo.findOne({ where: { chwId: body.chwId, tallyDate: body.tallyDate } });

    if (!tally) {
      tally = repo.create({
        chwId: body.chwId,
        tallyDate: body.tallyDate,
      });
    }

    Object.assign(tally, {
      householdsVisited: Number(body.householdsVisited ?? 0),
      ancVisits: Number(body.ancVisits ?? 0),
      postnatalVisits: Number(body.postnatalVisits ?? 0),
      sickChildrenSeen: Number(body.sickChildrenSeen ?? 0),
      tbDotObservations: Number(body.tbDotObservations ?? 0),
      muacScreenings: Number(body.muacScreenings ?? 0),
      samCasesIdentified: Number(body.samCasesIdentified ?? 0),
      referralsMade: Number(body.referralsMade ?? 0),
      immunizationsGiven: Number(body.immunizationsGiven ?? 0),
      dhis2Synced: Boolean(body.dhis2Synced ?? tally.dhis2Synced),
    });

    return repo.save(tally);
  }

  async batchSync(tenantId: string, userId: string, payload: BatchSyncPayload) {
    const db = await this.getDb(tenantId);
    let visitsCreated = 0;
    let talliesUpserted = 0;
    let tasksCompleted = 0;

    for (const visitPayload of payload.visits ?? []) {
      await this.saveVisit(db, userId, visitPayload, true);
      visitsCreated += 1;
    }

    for (const tallyPayload of payload.tallies ?? []) {
      await this.submitTally(tenantId, tallyPayload);
      talliesUpserted += 1;
    }

    for (const completion of payload.taskCompletions ?? []) {
      await this.completeTask(tenantId, completion.id, completion.notes ?? null);
      tasksCompleted += 1;
    }

    return { visitsCreated, talliesUpserted, tasksCompleted };
  }

  async getSupervisionDashboard(tenantId: string) {
    const db = await this.getDb(tenantId);
    return db.query(
      `
        SELECT
          stats.chw_id AS "chwId",
          stats.visits_30d AS visits,
          stats.sam_cases AS "samCases",
          stats.referrals AS referrals,
          COALESCE(tasks.tasks_completed, 0) AS "tasksCompleted"
        FROM (
          SELECT
            chw_id,
            COUNT(*) FILTER (WHERE visit_date >= CURRENT_DATE - INTERVAL '30 days') AS visits_30d,
            COUNT(*) FILTER (
              WHERE visit_date >= CURRENT_DATE - INTERVAL '30 days'
                AND muac_classification = 'SAM'
            ) AS sam_cases,
            COUNT(*) FILTER (
              WHERE visit_date >= CURRENT_DATE - INTERVAL '30 days'
                AND referred_to_facility = true
            ) AS referrals
          FROM chw_visits
          GROUP BY chw_id
        ) stats
        LEFT JOIN (
          SELECT
            assigned_to_chw_id,
            COUNT(*) FILTER (
              WHERE status = 'completed'
                AND completed_at >= NOW() - INTERVAL '30 days'
            ) AS tasks_completed
          FROM chw_tasks
          GROUP BY assigned_to_chw_id
        ) tasks ON tasks.assigned_to_chw_id = stats.chw_id
        ORDER BY stats.visits_30d DESC, stats.chw_id ASC
        LIMIT 50
      `,
    );
  }

  async getDefaulters(tenantId: string) {
    const db = await this.getDb(tenantId);
    return db.query(
      `
        SELECT
          t.id,
          t.patient_id AS "patientId",
          NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS "patientName",
          t.household_id AS "householdId",
          h.household_code AS "householdCode",
          t.task_type AS "taskType",
          t.due_date AS "dueDate",
          (CURRENT_DATE - t.due_date) AS "overdueDays",
          t.priority,
          t.instructions
        FROM chw_tasks t
        LEFT JOIN patients p ON p.id = t.patient_id
        LEFT JOIN households h ON h.id = t.household_id
        WHERE t.status = 'pending'
          AND t.due_date < CURRENT_DATE
        ORDER BY t.due_date ASC
      `,
    );
  }

  async pushTallyToDhis2(tenantId: string, tallyId: string) {
    const db = await this.getDb(tenantId);
    const repo = this.tallyRepo(db);
    const tally = await repo.findOne({ where: { id: tallyId } });
    if (!tally) {
      throw new NotFoundException('CHW tally not found');
    }

    const tenantConfig = await this.tenantService.getTenantDhis2Config(tenantId);
    const baseUrl = (tenantConfig?.baseUrl || process.env.DHIS2_BASE_URL || '').replace(/\/$/, '');
    const username = tenantConfig?.username || process.env.DHIS2_USERNAME || '';
    const password = tenantConfig?.password || process.env.DHIS2_PASSWORD || '';
    const dataSet = process.env.DHIS2_CHW_DATASET_UID || tenantConfig?.dataSetId || '';
    const orgUnit = tenantConfig?.orgUnitId || process.env.DHIS2_ORG_UNIT_ID || '';
    const map = JSON.parse(process.env.DHIS2_CHW_DE_MAP || '{}') as Record<string, string>;

    if (!baseUrl || !username || !password || !dataSet || !orgUnit) {
      throw new BadRequestException('DHIS2 CHW integration is not fully configured');
    }

    const fieldMap: Record<string, number> = {
      householdsVisited: tally.householdsVisited,
      ancVisits: tally.ancVisits,
      postnatalVisits: tally.postnatalVisits,
      sickChildrenSeen: tally.sickChildrenSeen,
      tbDotObservations: tally.tbDotObservations,
      muacScreenings: tally.muacScreenings,
      samCasesIdentified: tally.samCasesIdentified,
      referralsMade: tally.referralsMade,
      immunizationsGiven: tally.immunizationsGiven,
    };

    const dataValues = Object.entries(fieldMap)
      .filter(([key]) => Boolean(map[key]))
      .map(([key, value]) => ({
        dataElement: map[key],
        categoryOptionCombo:
          map[`${key}CategoryOptionCombo`] || process.env.DHIS2_DEFAULT_CATEGORY_OPTION_COMBO || undefined,
        value: String(value ?? 0),
      }));

    await axios.post(
      `${baseUrl}/api/dataValueSets`,
      {
        dataSet,
        completeDate: tally.tallyDate,
        period: tally.tallyDate.replace(/-/g, ''),
        orgUnit,
        dataValues,
      },
      {
        auth: { username, password },
      },
    );

    tally.dhis2Synced = true;
    return repo.save(tally);
  }
}
