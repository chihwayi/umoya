import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { SormasSyncLog } from './entities/sormas-sync-log.entity';
import { IhrNotification } from './entities/ihr-notification.entity';
import { EbsSignal } from './entities/ebs-signal.entity';
import { VhfCase } from '../entities/vhf-case.entity';
import { PlagueCase } from '../outbreak/entities/plague-case.entity';
import { YellowFeverCase } from '../outbreak/entities/yellow-fever-case.entity';
import { MeningitisCase } from '../outbreak/entities/meningitis-case.entity';
import { Patient } from '../entities/patient.entity';

type SourceCaseRow = VhfCase | PlagueCase | YellowFeverCase | MeningitisCase;

@Injectable()
export class SurveillanceService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async pushCaseToSormas(
    tenantId: string,
    userId: string | null,
    body: {
      localCaseId: string;
      sourceTable: string;
      casePayload?: Record<string, any>;
      sormasDisease?: string;
    },
  ): Promise<SormasSyncLog> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(SormasSyncLog);
    const source = await this.getSourceCase(db, body.sourceTable, body.localCaseId);
    const patient = await this.getSourcePatient(db, source);
    const sormasUrl = process.env.SORMAS_BASE_URL?.trim() || '';
    const sormasToken = process.env.SORMAS_API_TOKEN?.trim() || '';
    const sormasDisease = body.sormasDisease || this.mapSormasDisease(body.sourceTable, source);
    const payload = body.casePayload || this.buildSormasPayload(body.sourceTable, source, patient, sormasDisease);

    const existing = await repo.findOne({
      where: { localCaseId: body.localCaseId, syncDirection: 'push' },
    });
    const entity = existing
      ? Object.assign(existing, {
          sourceTable: body.sourceTable,
          sormasDisease,
          sormasInstanceUrl: sormasUrl || existing.sormasInstanceUrl || '',
          syncStatus: 'pending',
          httpStatusCode: null,
          errorMessage: null,
          lastAttemptedAt: new Date(),
          createdBy: userId,
        })
      : repo.create({
          sourceTable: body.sourceTable,
          localCaseId: body.localCaseId,
          sormasInstanceUrl: sormasUrl,
          sormasDisease,
          syncDirection: 'push',
          syncStatus: 'pending',
          lastAttemptedAt: new Date(),
          createdBy: userId,
        });
    const log = await repo.save(entity) as unknown as SormasSyncLog;

    if (!sormasUrl || !sormasToken) {
      await repo.update(log.id, {
        syncStatus: 'failed',
        errorMessage: 'SORMAS_BASE_URL or SORMAS_API_TOKEN not configured',
        retryCount: (log.retryCount || 0) + 1,
        sormasResponse: { payload },
      });
      return repo.findOneOrFail({ where: { id: log.id } });
    }

    try {
      const response = await axios.post(`${sormasUrl.replace(/\/$/, '')}/api/cases/push`, payload, {
        headers: {
          Authorization: `Bearer ${sormasToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      const responseData = response.data || {};
      await repo.update(log.id, {
        syncStatus: 'success',
        httpStatusCode: response.status,
        sormasCaseUuid: responseData.caseUuid || responseData.uuid || responseData?.data?.caseUuid || null,
        sormasPersonUuid: responseData.personUuid || responseData?.data?.personUuid || null,
        sormasResponse: responseData,
        lastSyncedAt: new Date(),
      });
    } catch (error: any) {
      await repo.update(log.id, {
        syncStatus: 'failed',
        httpStatusCode: error?.response?.status ?? null,
        errorMessage: error?.response?.data?.message || error?.message || 'SORMAS sync failed',
        retryCount: (log.retryCount || 0) + 1,
        sormasResponse: {
          payload,
          error: error?.response?.data || error?.message || null,
        },
      });
    }

    return repo.findOneOrFail({ where: { id: log.id } });
  }

  async getSormasSyncStatus(tenantId: string, localCaseId: string): Promise<SormasSyncLog[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(SormasSyncLog).find({
      where: { localCaseId },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getSormasSyncLogs(tenantId: string): Promise<SormasSyncLog[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(SormasSyncLog).find({
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  async retrySormasSync(
    tenantId: string,
    userId: string | null,
    logId: string,
  ): Promise<SormasSyncLog> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(SormasSyncLog);
    const log = await repo.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException('SORMAS sync log not found');
    }
    return this.pushCaseToSormas(tenantId, userId, {
      localCaseId: log.localCaseId,
      sourceTable: log.sourceTable,
      sormasDisease: log.sormasDisease,
    });
  }

  async createIhrNotification(
    tenantId: string,
    userId: string | null,
    body: Partial<IhrNotification>,
  ): Promise<IhrNotification> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(IhrNotification);
    const entity = repo.create({
      ...body,
      sourceCaseIds: Array.isArray(body.sourceCaseIds) ? body.sourceCaseIds : [],
      ihrAnnex2CriteriaMet: this.asJsonObject(body.ihrAnnex2CriteriaMet),
      notificationDate: body.notificationDate ? new Date(body.notificationDate) : new Date(),
      submittedBy: body.submittedBy ?? userId,
      submittedAt: body.submittedAt ?? new Date(),
    });
    const saved = await repo.save(entity) as unknown as IhrNotification;

    try {
      const assessment = await this.cdssService.surveillanceIhrAnnex2(
        this.buildIhrAssessmentPayload(saved),
        tenantId,
      );
      await repo.update(saved.id, {
        cdssAnnex2Assessment: assessment,
        cdssConfidence: this.numberOrNull(assessment?.confidence),
        pheicRelevant: Boolean(assessment?.pheic_notification_required),
      });
    } catch {}

    return repo.findOneOrFail({ where: { id: saved.id } });
  }

  async getIhrNotifications(tenantId: string): Promise<IhrNotification[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(IhrNotification).find({
      order: { notificationDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateIhrNotification(
    tenantId: string,
    id: string,
    body: Partial<IhrNotification>,
  ): Promise<IhrNotification> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(IhrNotification);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('IHR notification not found');
    }
    await repo.update(id, {
      ...body,
      ihrAnnex2CriteriaMet: body.ihrAnnex2CriteriaMet !== undefined
        ? this.asJsonObject(body.ihrAnnex2CriteriaMet)
        : existing.ihrAnnex2CriteriaMet,
      sourceCaseIds: body.sourceCaseIds !== undefined
        ? (Array.isArray(body.sourceCaseIds) ? body.sourceCaseIds : [])
        : existing.sourceCaseIds,
    } as object);
    return repo.findOneOrFail({ where: { id } });
  }

  async runIhrAnnex2Assessment(
    tenantId: string,
    id: string,
    criteria: Record<string, any>,
  ): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(IhrNotification);
    const notification = await repo.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException('IHR notification not found');
    }
    const result = await this.cdssService.surveillanceIhrAnnex2(
      {
        ...this.buildIhrAssessmentPayload(notification),
        ...criteria,
      },
      tenantId,
    );
    await repo.update(id, {
      cdssAnnex2Assessment: result,
      cdssConfidence: this.numberOrNull(result?.confidence),
      pheicRelevant: Boolean(result?.pheic_notification_required),
    });
    return result;
  }

  async reportEbsSignal(
    tenantId: string,
    userId: string | null,
    body: Partial<EbsSignal> & Record<string, any>,
  ): Promise<EbsSignal> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EbsSignal);
    const entity = repo.create({
      ...body,
      reportedBy: body.reportedBy ?? userId,
    });
    const saved = await repo.save(entity) as unknown as EbsSignal;

    try {
      const triage = await this.cdssService.surveillanceEbsTriage(
        {
          signal_source: saved.signalSource,
          signal_type: saved.signalType,
          disease_suspected: saved.diseaseSuspected,
          case_count: this.numberOrNull(body.caseCount),
          death_count: this.numberOrNull(body.deathCount),
          description: saved.description,
          district: saved.district || 'unknown',
          days_since_signal: this.daysSince(saved.createdAt),
          similar_signals_last_30_days: await this.getSimilarSignalsLast30Days(db, saved),
        },
        tenantId,
      );
      await repo.update(saved.id, {
        cdssRiskLevel: triage?.risk_level || null,
        cdssRecommendedAction: triage?.recommended_action || null,
        cdssConfidence: this.numberOrNull(triage?.confidence),
      });
    } catch {}

    return repo.findOneOrFail({ where: { id: saved.id } });
  }

  async getEbsSignals(tenantId: string, status?: string): Promise<EbsSignal[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(EbsSignal).find({
      where: status ? { triageStatus: status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async updateEbsSignal(tenantId: string, id: string, body: Partial<EbsSignal>): Promise<EbsSignal> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EbsSignal);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('EBS signal not found');
    }
    await repo.update(id, body as object);
    return repo.findOneOrFail({ where: { id } });
  }

  async getSurveillanceSummary(tenantId: string): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const sormasRepo = db.getRepository(SormasSyncLog);
    const ihrRepo = db.getRepository(IhrNotification);
    const ebsRepo = db.getRepository(EbsSignal);
    const [sormasTotal, sormasFailed, ihrTotal, pheicRelevant, ebsTotal, ebsUnverified] = await Promise.all([
      sormasRepo.count(),
      sormasRepo.count({ where: { syncStatus: 'failed' } }),
      ihrRepo.count(),
      ihrRepo.count({ where: { pheicRelevant: true } }),
      ebsRepo.count(),
      ebsRepo.count({ where: { triageStatus: 'unverified' } }),
    ]);
    return {
      sormas: { total: sormasTotal, failed: sormasFailed },
      ihr: { total: ihrTotal, pheicRelevant },
      ebs: { total: ebsTotal, unverified: ebsUnverified },
    };
  }

  private async getSimilarSignalsLast30Days(db: any, signal: EbsSignal): Promise<number> {
    return db.getRepository(EbsSignal).count({
      where: {
        signalType: signal.signalType,
        district: signal.district || null,
      },
    });
  }

  private async getSourceCase(db: any, sourceTable: string, id: string): Promise<SourceCaseRow> {
    const sourceMap: Record<string, any> = {
      vhf_cases: VhfCase,
      plague_cases: PlagueCase,
      yellow_fever_cases: YellowFeverCase,
      meningitis_cases: MeningitisCase,
    };
    const entity = sourceMap[sourceTable];
    if (!entity) {
      throw new NotFoundException('Unsupported surveillance source table');
    }
    const row = await db.getRepository(entity).findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Source case not found');
    }
    return row;
  }

  private async getSourcePatient(db: any, source: SourceCaseRow): Promise<Patient | null> {
    const patientId = (source as any).patientId;
    if (!patientId) {
      return null;
    }
    return db.getRepository(Patient).findOne({ where: { id: patientId } });
  }

  private mapSormasDisease(sourceTable: string, source: SourceCaseRow): string {
    if (sourceTable === 'vhf_cases') {
      const pathogen = String((source as any).pathogen || '').toLowerCase();
      if (pathogen.includes('mpox')) return 'MONKEYPOX';
      if (pathogen.includes('ebola')) return 'EVD';
      if (pathogen.includes('marburg')) return 'MARBURG';
      if (pathogen.includes('lassa')) return 'LASSA';
      return 'OTHER';
    }
    if (sourceTable === 'plague_cases') return 'PLAGUE';
    if (sourceTable === 'yellow_fever_cases') return 'YELLOW_FEVER';
    if (sourceTable === 'meningitis_cases') return 'CSM';
    return 'OTHER';
  }

  private buildSormasPayload(
    sourceTable: string,
    source: SourceCaseRow,
    patient: Patient | null,
    sormasDisease: string,
  ): Record<string, any> {
    const patientName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim();
    const classification = String((source as any).classification || 'suspected').toUpperCase();
    const reportDate = (source as any).dateReported || new Date().toISOString().slice(0, 10);
    const onsetDate = (source as any).onsetDate || (source as any).symptomOnsetDate || reportDate;
    return {
      disease: sormasDisease,
      diseaseVariant: sourceTable,
      reportDate,
      symptomsOnsetDate: onsetDate,
      caseClassification: classification,
      person: {
        firstName: patient?.firstName || patientName || 'Unknown',
        lastName: patient?.lastName || 'Patient',
        sex: patient?.gender || 'unknown',
        birthdate: patient?.dateOfBirth || null,
        nationalHealthId: patient?.nationalId || null,
        phone: patient?.phone || null,
        address: patient?.address || null,
      },
      localCase: {
        sourceTable,
        localCaseId: (source as any).id,
        patientId: (source as any).patientId || null,
      },
      clinicalSummary: this.buildClinicalSummary(sourceTable, source),
    };
  }

  private buildClinicalSummary(sourceTable: string, source: SourceCaseRow): Record<string, any> {
    if (sourceTable === 'vhf_cases') {
      return {
        pathogen: (source as any).pathogen || null,
        exposureType: (source as any).exposureType || null,
        labPcrResult: (source as any).labPcrResult || null,
        isolationStatus: (source as any).isolationStatus || null,
      };
    }
    if (sourceTable === 'plague_cases') {
      return {
        form: (source as any).form || null,
        buboLocation: (source as any).buboLocation || null,
        labPcrResult: (source as any).labPcrResult || null,
      };
    }
    if (sourceTable === 'yellow_fever_cases') {
      return {
        vaccinationStatus: (source as any).vaccinationStatus || null,
        phase: (source as any).phase || null,
        pcrResult: (source as any).pcrResult || null,
      };
    }
    return {
      pathogenSuspected: (source as any).pathogenSuspected || null,
      serogroup: (source as any).serogroup || null,
      csfPcr: (source as any).csfPcr || null,
    };
  }

  private buildIhrAssessmentPayload(notification: IhrNotification): Record<string, any> {
    const criteria = this.asJsonObject(notification.ihrAnnex2CriteriaMet);
    return {
      disease: notification.disease,
      is_pheic_listed: ['smallpox', 'polio', 'sars', 'covid', 'ebola', 'marburg'].includes(
        String(notification.disease || '').toLowerCase(),
      ),
      case_count: notification.caseCount,
      death_count: notification.deathCount,
      unusual_or_unexpected: Boolean(criteria.unusual_unexpected),
      significant_public_health_impact: Boolean(criteria.significant_public_health_impact),
      significant_international_spread: Boolean(criteria.significant_spread),
      trade_travel_restriction_risk: Boolean(criteria.travel_trade_restriction),
      affected_country: notification.affectedCountry,
      days_since_first_case: 0,
      healthcare_workers_affected: Boolean(criteria.healthcare_workers_affected),
      laboratory_confirmed: Boolean(criteria.laboratory_confirmed),
    };
  }

  private asJsonObject(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  private numberOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private daysSince(value: Date | string | null | undefined): number {
    if (!value) return 0;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
  }
}
