import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChronicDiseaseRegistry } from '../entities/chronic-disease-registry.entity';
import { PreventiveCareReminder } from '../entities/preventive-care-reminder.entity';
import { RecallList } from '../entities/recall-list.entity';
import { CdssService } from './cdss.service';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';

const CONDITION_TYPES = ['hypertension', 'diabetes', 'asthma', 'copd', 'ckd', 'heart_failure', 'obesity', 'depression', 'other'] as const;
const RISK_LEVELS = ['low', 'moderate', 'high', 'critical'] as const;
const STATUSES = ['active', 'controlled', 'uncontrolled', 'remission', 'resolved'] as const;
const PREVENTIVE_STATUSES = ['due', 'overdue', 'completed', 'deferred', 'not_applicable'] as const;
const WORKLIST_FOCUS = ['all', 'high-risk', 'uncontrolled', 'overdue-review', 'care-gaps'] as const;

@Injectable()
export class PopulationHealthService {
  private readonly logger = new Logger(PopulationHealthService.name);

  constructor(
    private readonly cdssService: CdssService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

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
    const saved = await repo.save(entity);

    // Fire-and-forget: ask CDSS if AI risk stratification differs from the submitted level.
    // If CDSS returns a higher risk level, upgrade the registry entry.
    this.cdssService.riskAssessment({
      patientId,
      diagnoses: [{ code: body.conditionCode, name: body.conditionName }],
      context: 'chronic_disease_registry',
      conditionType,
      specialty: body.conditionType === 'depression' ? 'mental_health' : 'primary_care',
      module: 'population_health',
    }).then(async (result: any) => {
      const cdssRisk = String(result?.risk_level || result?.risk || '').toLowerCase();
      const riskOrder = ['low', 'moderate', 'high', 'critical'];
      if (cdssRisk && RISK_LEVELS.includes(cdssRisk as any)) {
        if (riskOrder.indexOf(cdssRisk) > riskOrder.indexOf(riskLevel)) {
          await repo.update(saved.id, { riskLevel: cdssRisk } as any);
          this.logger.log(`[PopHealth] CDSS upgraded risk for patient ${patientId}: ${riskLevel} → ${cdssRisk}`);
        }
      }
    }).catch((e: any) => this.logger.warn(`[PopHealth] CDSS risk stratification failed: ${e?.message}`));

    return saved;
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

  async getDoctorWorklist(
    tenantDb: DataSource,
    options?: {
      includeResolved?: boolean;
      limit?: number;
      focus?: string;
      conditionType?: string;
      riskLevel?: string;
    },
  ): Promise<any> {
    const includeResolved = Boolean(options?.includeResolved);
    const focus = this.normalizeWorklistFocus(options?.focus);
    const limit = Number.isFinite(Number(options?.limit))
      ? Math.min(Math.max(Number(options?.limit), 1), 250)
      : 80;

    const registryRepo = tenantDb.getRepository(ChronicDiseaseRegistry);
    const registryQb = registryRepo
      .createQueryBuilder('r')
      .orderBy('r.updated_at', 'DESC')
      .addOrderBy('r.created_at', 'DESC');

    if (!includeResolved) {
      registryQb.andWhere('r.status != :resolved', { resolved: 'resolved' });
    }
    if (options?.conditionType) {
      registryQb.andWhere('r.condition_type = :conditionType', { conditionType: options.conditionType });
    }
    if (options?.riskLevel) {
      registryQb.andWhere('r.risk_level = :riskLevel', { riskLevel: options.riskLevel });
    }

    const registryRows = await registryQb.getMany();
    if (!registryRows.length) {
      return {
        summary: {
          total: 0,
          critical: 0,
          high: 0,
          moderate: 0,
          low: 0,
          overdueReviews: 0,
          dueSoonReviews: 0,
          uncontrolledCount: 0,
          patientsWithCareGaps: 0,
          patientsWithOverdueCareGaps: 0,
          avgRiskScore: 0,
          avgCareGaps: 0,
        },
        items: [],
      };
    }

    const patientIds = [...new Set(registryRows.map((entry) => entry.patientId).filter(Boolean))];
    const patients = patientIds.length
      ? await tenantDb.query(
          `SELECT id, first_name, last_name, patient_number, gender, date_of_birth
           FROM patients
           WHERE id = ANY($1::uuid[])`,
          [patientIds],
        )
      : [];
    const patientById = new Map<string, any>((patients as any[]).map((p) => [p.id, p]));

    const reminderRows = patientIds.length
      ? await tenantDb.query(
          `SELECT id, patient_id, screening_type, status, due_date, reminder_sent
           FROM preventive_care_reminders
           WHERE patient_id = ANY($1::uuid[]) AND status IN ('due', 'overdue')
           ORDER BY
             CASE WHEN status = 'overdue' THEN 0 ELSE 1 END,
             due_date ASC NULLS LAST`,
          [patientIds],
        )
      : [];
    const reminderByPatient = new Map<string, any[]>();
    for (const row of reminderRows as any[]) {
      const list = reminderByPatient.get(row.patient_id) || [];
      list.push(row);
      reminderByPatient.set(row.patient_id, list);
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const hydrated = registryRows.map((entry) => {
      const patient = patientById.get(entry.patientId) || {};
      const reminders = reminderByPatient.get(entry.patientId) || [];
      const overdueCareGapCount = reminders.filter((r) => this.resolveReminderStatus(r.status, r.due_date, todayStr) === 'overdue').length;
      const careGapCount = reminders.length;
      const ageYears = this.getAgeYears(patient?.date_of_birth);

      const nextReviewIso = entry.nextReviewDate ? new Date(entry.nextReviewDate).toISOString().slice(0, 10) : null;
      const reviewDeltaDays = nextReviewIso
        ? Math.floor((new Date(nextReviewIso).getTime() - new Date(todayStr).getTime()) / (24 * 60 * 60 * 1000))
        : null;
      const reviewOverdueDays = reviewDeltaDays !== null && reviewDeltaDays < 0 ? Math.abs(reviewDeltaDays) : 0;

      const slaStatus =
        entry.status === 'resolved'
          ? 'resolved'
          : reviewDeltaDays === null
          ? 'warning'
          : reviewDeltaDays < 0
          ? 'overdue'
          : reviewDeltaDays <= 7
          ? 'warning'
          : 'on_track';

      const riskScore = this.calculateRiskScore({
        riskLevel: entry.riskLevel,
        conditionStatus: entry.status,
        reviewOverdueDays,
        careGapCount,
        overdueCareGapCount,
        reviewDeltaDays,
      });
      const priority = riskScore >= 85 ? 'critical' : riskScore >= 65 ? 'high' : riskScore >= 40 ? 'moderate' : 'low';

      const payload = {
        id: entry.id,
        patientId: entry.patientId,
        patientNumber: patient?.patient_number || null,
        patientName: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Unknown patient',
        patientAge: ageYears,
        patientGender: patient?.gender || null,
        conditionCode: entry.conditionCode,
        conditionName: entry.conditionName,
        conditionType: entry.conditionType,
        conditionStatus: entry.status,
        riskLevel: entry.riskLevel,
        priority,
        riskScore,
        slaStatus,
        lastReviewDate: entry.lastReviewDate ? new Date(entry.lastReviewDate).toISOString().slice(0, 10) : null,
        nextReviewDate: nextReviewIso,
        managementPlan: entry.managementPlan || null,
        reviewDeltaDays,
        reviewOverdueDays,
        careGapCount,
        overdueCareGapCount,
        dueCareGapCount: careGapCount - overdueCareGapCount,
        pendingReminders: reminders.slice(0, 6).map((item) => ({
          id: item.id,
          screeningType: item.screening_type,
          status: this.resolveReminderStatus(item.status, item.due_date, todayStr),
          dueDate: item.due_date ? new Date(item.due_date).toISOString().slice(0, 10) : null,
          reminderSent: Boolean(item.reminder_sent),
        })),
        createdAt: entry.createdAt ? entry.createdAt.toISOString() : null,
        updatedAt: entry.updatedAt ? entry.updatedAt.toISOString() : null,
      };

      return {
        ...payload,
        recommendedActions: this.buildRecommendedActions(payload),
      };
    });

    const filtered = hydrated.filter((item) => {
      if (focus === 'high-risk') return item.priority === 'critical' || item.priority === 'high';
      if (focus === 'uncontrolled') return String(item.conditionStatus) === 'uncontrolled';
      if (focus === 'overdue-review') return String(item.slaStatus) === 'overdue';
      if (focus === 'care-gaps') return Number(item.careGapCount) > 0;
      return true;
    });

    const priorityOrder = { critical: 0, high: 1, moderate: 2, low: 3 } as const;
    filtered.sort((a, b) => {
      const priorityDelta = (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4);
      if (priorityDelta !== 0) return priorityDelta;
      if ((b.riskScore || 0) !== (a.riskScore || 0)) return (b.riskScore || 0) - (a.riskScore || 0);
      if ((b.overdueCareGapCount || 0) !== (a.overdueCareGapCount || 0)) return (b.overdueCareGapCount || 0) - (a.overdueCareGapCount || 0);
      return (b.reviewOverdueDays || 0) - (a.reviewOverdueDays || 0);
    });

    const avgRiskScore = filtered.length
      ? Math.round((filtered.reduce((sum, item) => sum + Number(item.riskScore || 0), 0) / filtered.length) * 10) / 10
      : 0;
    const avgCareGaps = filtered.length
      ? Math.round((filtered.reduce((sum, item) => sum + Number(item.careGapCount || 0), 0) / filtered.length) * 10) / 10
      : 0;
    const summary = {
      total: filtered.length,
      critical: filtered.filter((item) => item.priority === 'critical').length,
      high: filtered.filter((item) => item.priority === 'high').length,
      moderate: filtered.filter((item) => item.priority === 'moderate').length,
      low: filtered.filter((item) => item.priority === 'low').length,
      overdueReviews: filtered.filter((item) => item.slaStatus === 'overdue').length,
      dueSoonReviews: filtered.filter((item) => item.slaStatus === 'warning').length,
      uncontrolledCount: filtered.filter((item) => String(item.conditionStatus) === 'uncontrolled').length,
      patientsWithCareGaps: filtered.filter((item) => Number(item.careGapCount) > 0).length,
      patientsWithOverdueCareGaps: filtered.filter((item) => Number(item.overdueCareGapCount) > 0).length,
      avgRiskScore,
      avgCareGaps,
    };

    return {
      summary,
      items: filtered.slice(0, limit),
      meta: {
        includeResolved,
        focus,
        limit,
      },
    };
  }

  async getOperationalBrief(
    tenantDb: DataSource,
    options?: {
      includeResolved?: boolean;
      limit?: number;
      focus?: string;
      conditionType?: string;
      riskLevel?: string;
    },
  ): Promise<any> {
    const dashboard = await this.getRegistryDashboard(tenantDb, {
      conditionType: options?.conditionType,
      riskLevel: options?.riskLevel,
    }).catch(() => ({
      totalByCondition: {},
      totalByRisk: {},
      overdueReviews: 0,
      uncontrolledCount: 0,
      total: 0,
    }));

    const worklist = await this.getDoctorWorklist(tenantDb, {
      includeResolved: Boolean(options?.includeResolved),
      limit: Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 120,
      focus: options?.focus || 'all',
      conditionType: options?.conditionType,
      riskLevel: options?.riskLevel,
    }).catch(() => ({ summary: {}, items: [] }));

    const items = Array.isArray(worklist?.items) ? worklist.items : [];
    const countChecklistItems = (item: any): number => {
      const checks = [
        Boolean(item?.conditionName),
        Boolean(item?.conditionType),
        Boolean(item?.riskLevel),
        Boolean(item?.conditionStatus),
        Boolean(item?.nextReviewDate),
        Boolean(item?.managementPlan),
        Number(item?.careGapCount || 0) >= 0,
      ];
      return checks.filter(Boolean).length;
    };

    const highPriorityQueue = [...items]
      .sort((a: any, b: any) => {
        const priorityRank = { critical: 0, high: 1, moderate: 2, low: 3 } as const;
        const byPriority =
          (priorityRank[String(a?.priority || 'low').toLowerCase() as keyof typeof priorityRank] ?? 4) -
          (priorityRank[String(b?.priority || 'low').toLowerCase() as keyof typeof priorityRank] ?? 4);
        if (byPriority !== 0) return byPriority;
        if (Number(b?.riskScore || 0) !== Number(a?.riskScore || 0)) {
          return Number(b?.riskScore || 0) - Number(a?.riskScore || 0);
        }
        return Number(b?.overdueCareGapCount || 0) - Number(a?.overdueCareGapCount || 0);
      })
      .slice(0, 10)
      .map((item: any) => {
        const missingNextReview = !Boolean(item?.nextReviewDate);
        const missingManagementPlan = !Boolean(item?.managementPlan);
        const uncontrolledNoRecentReview =
          String(item?.conditionStatus || '').toLowerCase() === 'uncontrolled' &&
          (item?.reviewDeltaDays === null || Number(item?.reviewDeltaDays || 0) <= -30);
        const overdueOutreachNotSent = Array.isArray(item?.pendingReminders)
          ? item.pendingReminders.some(
              (reminder: any) =>
                String(reminder?.status || '').toLowerCase() === 'overdue' && !Boolean(reminder?.reminderSent),
            )
          : false;

        const cdssFlags: string[] = [];
        if (missingNextReview) cdssFlags.push('Next review date missing');
        if (missingManagementPlan) cdssFlags.push('Management plan missing');
        if (uncontrolledNoRecentReview) cdssFlags.push('Uncontrolled without recent review');
        if (overdueOutreachNotSent) cdssFlags.push('Overdue gap outreach not sent');

        return {
          id: item.id,
          patientId: item.patientId,
          patientName: item.patientName || 'Unknown patient',
          patientNumber: item.patientNumber || null,
          conditionName: item.conditionName || 'Condition',
          conditionType: item.conditionType || null,
          priority: item.priority || 'low',
          riskLevel: item.riskLevel || 'low',
          riskScore: Number(item.riskScore || 0),
          slaStatus: item.slaStatus || 'on_track',
          careGapCount: Number(item.careGapCount || 0),
          overdueCareGapCount: Number(item.overdueCareGapCount || 0),
          missingNextReview,
          missingManagementPlan,
          uncontrolledNoRecentReview,
          overdueOutreachNotSent,
          checklistCompleteCount: countChecklistItems(item),
          checklistTotalCount: 7,
          cdssFlags,
          recommendedActions: Array.isArray(item.recommendedActions)
            ? item.recommendedActions.slice(0, 3)
            : [],
        };
      });

    const missingNextReviewCount = highPriorityQueue.filter((item: any) => Boolean(item.missingNextReview)).length;
    const missingManagementPlanCount = highPriorityQueue.filter((item: any) => Boolean(item.missingManagementPlan)).length;
    const uncontrolledNoRecentReviewCount = highPriorityQueue.filter(
      (item: any) => Boolean(item.uncontrolledNoRecentReview),
    ).length;
    const overdueOutreachNotSentCount = highPriorityQueue.filter(
      (item: any) => Boolean(item.overdueOutreachNotSent),
    ).length;
    const checklistTotal = highPriorityQueue.reduce(
      (sum: number, item: any) => sum + Number(item?.checklistTotalCount || 0),
      0,
    );
    const checklistComplete = highPriorityQueue.reduce(
      (sum: number, item: any) => sum + Number(item?.checklistCompleteCount || 0),
      0,
    );
    const cdssCoveragePercent =
      checklistTotal > 0 ? Number(((checklistComplete / checklistTotal) * 100).toFixed(1)) : 0;

    const recommendations = new Set<string>();
    if (Number(worklist?.summary?.critical || 0) > 0 || Number(worklist?.summary?.high || 0) > 0) {
      recommendations.add('Prioritize critical/high-risk chronic-care patients for same-day intervention planning.');
    }
    if (Number(worklist?.summary?.overdueReviews || 0) > 0) {
      recommendations.add('Clear overdue chronic-care review appointments and update management plans.');
    }
    if (Number(worklist?.summary?.patientsWithOverdueCareGaps || 0) > 0) {
      recommendations.add('Launch proactive outreach for overdue preventive-care gaps before next review cycle.');
    }
    if (Number(dashboard?.uncontrolledCount || 0) > 0) {
      recommendations.add('Escalate uncontrolled cohorts into multidisciplinary care-pathway reviews.');
    }
    if (missingNextReviewCount > 0) {
      recommendations.add('Set next-review dates for high-priority registry entries lacking follow-up scheduling.');
    }
    if (missingManagementPlanCount > 0) {
      recommendations.add('Document actionable management plans for high-risk chronic-care patients.');
    }
    if (uncontrolledNoRecentReviewCount > 0) {
      recommendations.add('Escalate uncontrolled patients without recent review to urgent clinician callback workflow.');
    }
    if (overdueOutreachNotSentCount > 0) {
      recommendations.add('Trigger outreach for overdue preventive-care gaps where reminders were not sent.');
    }
    if (cdssCoveragePercent < 85) {
      recommendations.add('Improve structured registry documentation to raise population-health CDSS coverage.');
    }
    for (const item of highPriorityQueue) {
      for (const action of item.recommendedActions || []) {
        if (String(action || '').trim()) {
          recommendations.add(String(action).trim());
        }
      }
      if (recommendations.size >= 8) break;
    }
    if (!recommendations.size) {
      recommendations.add('Maintain preventive-care cadence and registry documentation quality checks.');
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRegistry: Number(dashboard?.total || 0),
        overdueReviews: Number(worklist?.summary?.overdueReviews || dashboard?.overdueReviews || 0),
        uncontrolledCount: Number(worklist?.summary?.uncontrolledCount || dashboard?.uncontrolledCount || 0),
        highPriorityCount:
          Number(worklist?.summary?.critical || 0) + Number(worklist?.summary?.high || 0),
        patientsWithCareGaps: Number(worklist?.summary?.patientsWithCareGaps || 0),
        patientsWithOverdueCareGaps: Number(worklist?.summary?.patientsWithOverdueCareGaps || 0),
        missingNextReviewCount,
        missingManagementPlanCount,
        uncontrolledNoRecentReviewCount,
        overdueOutreachNotSentCount,
        cdssCoveragePercent,
        avgRiskScore: Number(worklist?.summary?.avgRiskScore || 0),
        avgCareGaps: Number(worklist?.summary?.avgCareGaps || 0),
      },
      distribution: {
        byCondition: dashboard?.totalByCondition || {},
        byRisk: dashboard?.totalByRisk || {},
      },
      highPriorityQueue,
      recommendations: Array.from(recommendations).slice(0, 8),
    };
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

      // CDSS care-gap detection for additional AI-identified gaps beyond static rules
      this.cdssService.detectCareGaps(
        age,
        gender,
        [],
        [],
        {
          tenantDb,
          patientId: pid,
          context: 'preventive_care',
          specialty: 'primary_care',
          module: 'population_health',
        },
      ).then(async (cdssGaps: any) => {
        const gaps: any[] = cdssGaps?.gaps || cdssGaps?.care_gaps || [];
        for (const gap of gaps) {
          const screeningType = String(gap.screening_type || gap.type || '').toLowerCase().replace(/\s+/g, '_');
          if (!screeningType || types.has(screeningType)) continue;
          await repo.save(repo.create({
            patientId: pid,
            screeningType,
            dueDate: gap.due_date ? new Date(gap.due_date) : new Date(today),
            status: 'due',
          }));
          generated++;
        }
      }).catch(() => { /* CDSS offline — static rules already applied */ });
    }
    return { generated };
  }

  async updatePreventiveReminderStatus(
    tenantDb: DataSource,
    reminderId: string,
    body: {
      status: string;
      notes?: string;
      completionDate?: string;
    },
  ): Promise<PreventiveCareReminder> {
    const repo = tenantDb.getRepository(PreventiveCareReminder);
    const reminder = await repo.findOne({ where: { id: reminderId } });
    if (!reminder) {
      throw new NotFoundException('Preventive care reminder not found');
    }

    const normalizedStatus = String(body?.status || '').toLowerCase().trim();
    if (!PREVENTIVE_STATUSES.includes(normalizedStatus as any)) {
      throw new BadRequestException('Invalid reminder status');
    }

    reminder.status = normalizedStatus;
    if (normalizedStatus === 'completed') {
      reminder.lastCompletedDate = body?.completionDate ? new Date(body.completionDate) : new Date();
    }
    if (normalizedStatus === 'due' || normalizedStatus === 'overdue') {
      reminder.lastCompletedDate = null;
    }
    if (body?.notes !== undefined) {
      reminder.notes = body.notes || null;
    }

    return repo.save(reminder);
  }

  async recordRegistryReview(
    tenantDb: DataSource,
    registryId: string,
    body: {
      status?: string;
      riskLevel?: string;
      nextReviewDate?: string;
      reviewIntervalDays?: number;
      managementPlan?: string;
      reviewNote?: string;
    },
  ): Promise<ChronicDiseaseRegistry> {
    const repo = tenantDb.getRepository(ChronicDiseaseRegistry);
    const record = await repo.findOne({ where: { id: registryId } });
    if (!record) {
      throw new NotFoundException('Registry entry not found');
    }

    if (body?.status) {
      const normalizedStatus = String(body.status).toLowerCase();
      if (!STATUSES.includes(normalizedStatus as any)) {
        throw new BadRequestException('Invalid registry status');
      }
      record.status = normalizedStatus;
    }

    if (body?.riskLevel) {
      const normalizedRisk = String(body.riskLevel).toLowerCase();
      if (!RISK_LEVELS.includes(normalizedRisk as any)) {
        throw new BadRequestException('Invalid risk level');
      }
      record.riskLevel = normalizedRisk;
    }

    record.lastReviewDate = new Date();

    if (body?.nextReviewDate) {
      record.nextReviewDate = new Date(body.nextReviewDate);
    } else if (Number.isFinite(Number(body?.reviewIntervalDays))) {
      const reviewDays = Math.min(Math.max(Number(body.reviewIntervalDays), 1), 365);
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + reviewDays);
      record.nextReviewDate = nextReview;
    }

    if (body?.managementPlan !== undefined) {
      record.managementPlan = body.managementPlan || null;
    }

    if (body?.reviewNote && String(body.reviewNote).trim()) {
      const currentNotes = record.notes ? `${record.notes}\n` : '';
      record.notes = `${currentNotes}[${new Date().toISOString()}] ${String(body.reviewNote).trim()}`;
    }

    return repo.save(record);
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
    if (criteria.riskLevel) {
      const riskLevels = Array.isArray(criteria.riskLevel)
        ? criteria.riskLevel
        : [criteria.riskLevel];
      const rows = await tenantDb.query(
        `SELECT DISTINCT patient_id
         FROM chronic_disease_registry
         WHERE risk_level = ANY($1::text[])`,
        [riskLevels],
      );
      const fromRisk = (rows as any[]).map((r) => r.patient_id);
      patientIds = patientIds.length ? patientIds.filter((id) => fromRisk.includes(id)) : fromRisk;
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
    channel: 'sms' | 'email',
  ): Promise<{ sent: number; failed: number; patientIds: string[] }> {
    const [list] = await tenantDb.query(`SELECT * FROM recall_lists WHERE id = $1`, [listId]);
    if (!list) throw new NotFoundException('Recall list not found');

    const { patientIds } = await this.generateRecallListPatients(tenantDb, listId);
    if (!patientIds.length) return { sent: 0, failed: 0, patientIds };

    const patients = await tenantDb.query(
      `SELECT id, phone, email, first_name FROM patients WHERE id = ANY($1::uuid[])`,
      [patientIds],
    ).catch(() => []);

    const message = list.description
      ? `Recall: ${list.name} — ${list.description}`
      : `Recall reminder: ${list.name}. Please contact your clinic.`;

    let sent = 0;
    let failed = 0;

    for (const p of patients) {
      try {
        if (channel === 'sms' && p.phone && this.notificationsService) {
          await this.notificationsService.sendSms({ phone: p.phone, message }, tenantDb);
          sent++;
        } else if (channel === 'email' && p.email && this.emailService) {
          await this.emailService.sendEmail({
            to: p.email,
            subject: `Recall: ${list.name}`,
            text: message,
            html: `<p>${message}</p>`,
          });
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { sent, failed, patientIds };
  }

  private normalizeWorklistFocus(focus?: string): (typeof WORKLIST_FOCUS)[number] {
    const normalized = String(focus || 'all').toLowerCase();
    return WORKLIST_FOCUS.includes(normalized as any) ? (normalized as (typeof WORKLIST_FOCUS)[number]) : 'all';
  }

  private getAgeYears(dateOfBirth?: string | Date | null): number | null {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const diff = Date.now() - dob.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  }

  private resolveReminderStatus(
    sourceStatus?: string | null,
    dueDate?: string | Date | null,
    todayIso: string = new Date().toISOString().slice(0, 10),
  ): string {
    if (String(sourceStatus || '').toLowerCase() === 'overdue') return 'overdue';
    if (String(sourceStatus || '').toLowerCase() === 'due') {
      if (!dueDate) return 'due';
      const due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) return 'due';
      return due < new Date(todayIso) ? 'overdue' : 'due';
    }
    return String(sourceStatus || 'due').toLowerCase();
  }

  private calculateRiskScore(input: {
    riskLevel: string;
    conditionStatus: string;
    reviewOverdueDays: number;
    careGapCount: number;
    overdueCareGapCount: number;
    reviewDeltaDays: number | null;
  }): number {
    const baseRisk =
      input.riskLevel === 'critical'
        ? 58
        : input.riskLevel === 'high'
        ? 44
        : input.riskLevel === 'moderate'
        ? 28
        : 14;
    const uncontrolledBoost = input.conditionStatus === 'uncontrolled' ? 16 : 0;
    const reviewBoost = Math.min(input.reviewOverdueDays * 1.5, 20);
    const gapBoost = Math.min(input.careGapCount * 4, 16);
    const overdueGapBoost = Math.min(input.overdueCareGapCount * 6, 22);
    const soonReviewBoost =
      input.reviewDeltaDays !== null && input.reviewDeltaDays >= 0 && input.reviewDeltaDays <= 7
        ? 5
        : 0;

    const score = baseRisk + uncontrolledBoost + reviewBoost + gapBoost + overdueGapBoost + soonReviewBoost;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private buildRecommendedActions(item: {
    conditionStatus: string;
    slaStatus: string;
    overdueCareGapCount: number;
    careGapCount: number;
    riskLevel: string;
    conditionName: string;
  }): string[] {
    const actions: string[] = [];
    if (item.slaStatus === 'overdue') {
      actions.push('Book chronic-care review within 48 hours');
    } else if (item.slaStatus === 'warning') {
      actions.push('Confirm follow-up plan before review window closes');
    }

    if (item.conditionStatus === 'uncontrolled') {
      actions.push(`Escalate treatment optimization for ${item.conditionName}`);
    }

    if (item.overdueCareGapCount > 0) {
      actions.push('Close overdue preventive-care gaps and contact patient');
    } else if (item.careGapCount > 0) {
      actions.push('Schedule due preventive screenings');
    }

    if (item.riskLevel === 'critical' || item.riskLevel === 'high') {
      actions.push('Route to multidisciplinary review and close-loop outreach');
    }

    if (!actions.length) {
      actions.push('Continue current care plan and monitor registry KPIs');
    }

    return actions.slice(0, 4);
  }
}
