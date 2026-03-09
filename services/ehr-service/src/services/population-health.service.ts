import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChronicDiseaseRegistry } from '../entities/chronic-disease-registry.entity';
import { PreventiveCareReminder } from '../entities/preventive-care-reminder.entity';
import { RecallList } from '../entities/recall-list.entity';

const CONDITION_TYPES = ['hypertension', 'diabetes', 'asthma', 'copd', 'ckd', 'heart_failure', 'obesity', 'depression', 'other'] as const;
const RISK_LEVELS = ['low', 'moderate', 'high', 'critical'] as const;
const STATUSES = ['active', 'controlled', 'uncontrolled', 'remission', 'resolved'] as const;

@Injectable()
export class PopulationHealthService {
  private readonly logger = new Logger(PopulationHealthService.name);

  async enrollInRegistry(
    tenantDb: DataSource,
    patientId: string,
    body: {
      conditionCode: string;
      conditionName: string;
      conditionType: string;
      onsetDate?: string;
      status?: string;
      riskLevel?: string;
      nextReviewDate?: string;
      managementPlan?: string;
      notes?: string;
    },
  ): Promise<ChronicDiseaseRegistry> {
    const repo = tenantDb.getRepository(ChronicDiseaseRegistry);
    const conditionType = CONDITION_TYPES.includes(body.conditionType as any) ? body.conditionType : 'other';
    const status = STATUSES.includes((body.status || 'active') as any) ? (body.status || 'active') : 'active';
    const riskLevel = RISK_LEVELS.includes((body.riskLevel || 'moderate') as any) ? (body.riskLevel || 'moderate') : 'moderate';
    const entity = repo.create({
      patientId,
      conditionCode: body.conditionCode,
      conditionName: body.conditionName,
      conditionType,
      onsetDate: body.onsetDate ? new Date(body.onsetDate) : null,
      status,
      riskLevel,
      nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      managementPlan: body.managementPlan ?? null,
      notes: body.notes ?? null,
    });
    return repo.save(entity);
  }

  async getRegistryDashboard(
    tenantDb: DataSource,
    filters?: { conditionType?: string; riskLevel?: string; status?: string },
  ): Promise<{
    totalByCondition: Record<string, number>;
    totalByRisk: Record<string, number>;
    overdueReviews: number;
    uncontrolledCount: number;
    total: number;
  }> {
    const repo = tenantDb.getRepository(ChronicDiseaseRegistry);
    const qb = repo.createQueryBuilder('r');
    if (filters?.conditionType) qb.andWhere('r.condition_type = :ct', { ct: filters.conditionType });
    if (filters?.riskLevel) qb.andWhere('r.risk_level = :rl', { rl: filters.riskLevel });
    if (filters?.status) qb.andWhere('r.status = :st', { st: filters.status });
    const all = await qb.getMany();
    const totalByCondition: Record<string, number> = {};
    const totalByRisk: Record<string, number> = {};
    let overdueReviews = 0;
    let uncontrolledCount = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const r of all) {
      totalByCondition[r.conditionType] = (totalByCondition[r.conditionType] || 0) + 1;
      totalByRisk[r.riskLevel] = (totalByRisk[r.riskLevel] || 0) + 1;
      if (r.nextReviewDate && r.nextReviewDate < new Date(today)) overdueReviews++;
      if (r.status === 'uncontrolled') uncontrolledCount++;
    }
    return {
      totalByCondition,
      totalByRisk,
      overdueReviews,
      uncontrolledCount,
      total: all.length,
    };
  }

  async getRegistryByPatient(tenantDb: DataSource, patientId: string): Promise<ChronicDiseaseRegistry[]> {
    const repo = tenantDb.getRepository(ChronicDiseaseRegistry);
    return repo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async getPreventiveCareReminders(tenantDb: DataSource, patientId: string): Promise<PreventiveCareReminder[]> {
    const repo = tenantDb.getRepository(PreventiveCareReminder);
    return repo.find({ where: { patientId }, order: { dueDate: 'ASC' } });
  }

  /**
   * Generate preventive care reminders for a patient (or all) based on age, sex, and conditions.
   */
  async generatePreventiveCareReminders(
    tenantDb: DataSource,
    patientId?: string,
  ): Promise<{ generated: number }> {
    const today = new Date().toISOString().slice(0, 10);
    let patientIds: string[] = [];
    if (patientId) {
      patientIds = [patientId];
    } else {
      const rows = await tenantDb.query(`SELECT id FROM patients LIMIT 5000`);
      patientIds = (rows as any[]).map((r) => r.id);
    }
    const repo = tenantDb.getRepository(PreventiveCareReminder);
    let generated = 0;
    for (const pid of patientIds) {
      const [pat] = await tenantDb.query(
        `SELECT date_of_birth, gender FROM patients WHERE id = $1`,
        [pid],
      ) as any[];
      if (!pat) continue;
      const dob = pat.date_of_birth ? new Date(pat.date_of_birth) : null;
      const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
      const gender = (pat.gender || '').toLowerCase();
      const existing = await repo.find({ where: { patientId: pid } });
      const types = new Set(existing.map((e) => e.screeningType));
      const toAdd: Partial<PreventiveCareReminder>[] = [];
      if (age !== null) {
        if (age >= 45 && age <= 75 && !types.has('colonoscopy')) {
          toAdd.push({ patientId: pid, screeningType: 'colonoscopy', dueDate: new Date(today), status: 'due' });
        }
        if (age >= 40 && !types.has('lipid_panel')) {
          toAdd.push({ patientId: pid, screeningType: 'lipid_panel', dueDate: new Date(today), status: 'due' });
        }
        if (gender === 'female' && age >= 50 && age <= 74 && !types.has('mammography')) {
          toAdd.push({ patientId: pid, screeningType: 'mammography', dueDate: new Date(today), status: 'due' });
        }
        if (gender === 'female' && age >= 65 && !types.has('bone_density')) {
          toAdd.push({ patientId: pid, screeningType: 'bone_density', dueDate: new Date(today), status: 'due' });
        }
      }
      const hasDiabetes = await tenantDb.query(
        `SELECT 1 FROM chronic_disease_registry WHERE patient_id = $1 AND condition_type = 'diabetes' LIMIT 1`,
        [pid],
      );
      if ((hasDiabetes as any[]).length > 0) {
        if (!types.has('hba1c')) toAdd.push({ patientId: pid, screeningType: 'hba1c', dueDate: new Date(today), status: 'due' });
        if (!types.has('diabetic_eye_exam')) toAdd.push({ patientId: pid, screeningType: 'diabetic_eye_exam', dueDate: new Date(today), status: 'due' });
      }
      for (const item of toAdd) {
        await repo.save(repo.create(item));
        generated++;
      }
    }
    return { generated };
  }

  async createRecallList(
    tenantDb: DataSource,
    name: string,
    criteria: Record<string, any>,
    createdBy: string | null,
  ): Promise<RecallList> {
    const repo = tenantDb.getRepository(RecallList);
    const list = repo.create({ name, criteria, patientCount: 0, createdBy });
    return repo.save(list);
  }

  async getRecallLists(tenantDb: DataSource): Promise<RecallList[]> {
    const repo = tenantDb.getRepository(RecallList);
    return repo.find({ order: { createdAt: 'DESC' } });
  }

  async generateRecallListPatients(tenantDb: DataSource, listId: string): Promise<{ patientIds: string[] }> {
    const [list] = await tenantDb.query(`SELECT criteria FROM recall_lists WHERE id = $1`, [listId]) as any[];
    if (!list) return { patientIds: [] };
    const criteria = list.criteria || {};
    let patientIds: string[] = [];
    if (criteria.overdueScreenings) {
      const rows = await tenantDb.query(
        `SELECT DISTINCT patient_id FROM preventive_care_reminders WHERE status IN ('due','overdue') AND (due_date IS NULL OR due_date <= CURRENT_DATE)`
      );
      patientIds = (rows as any[]).map((r) => r.patient_id);
    }
    if (criteria.conditionType) {
      const rows = await tenantDb.query(
        `SELECT DISTINCT patient_id FROM chronic_disease_registry WHERE condition_type = $1`,
        [criteria.conditionType],
      );
      const fromCond = (rows as any[]).map((r) => r.patient_id);
      patientIds = patientIds.length ? patientIds.filter((id) => fromCond.includes(id)) : fromCond;
    }
    patientIds = [...new Set(patientIds)];
    await tenantDb.query(
      `UPDATE recall_lists SET patient_count = $1, last_generated_at = NOW() WHERE id = $2`,
      [patientIds.length, listId],
    );
    return { patientIds };
  }

  async notifyRecallList(
    tenantDb: DataSource,
    listId: string,
    _channel: 'sms' | 'email',
  ): Promise<{ sent: number; patientIds: string[] }> {
    const { patientIds } = await this.generateRecallListPatients(tenantDb, listId);
    return { sent: 0, patientIds };
  }
}
