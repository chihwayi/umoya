import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DataSource } from 'typeorm';
import { AnimalExposure } from '../entities/animal-exposure.entity';
import { ImmunizationRecord } from '../entities/immunization-record.entity';
import { OneHealthReport } from '../entities/one-health-report.entity';
import { CdssService } from './cdss.service';
import { TenantService } from './tenant.service';

type PepScheduleItem = {
  doseNumber: number;
  scheduledDate: string;
  status: 'given' | 'missed' | 'contraindicated';
};

@Injectable()
export class OneHealthService {
  private readonly logger = new Logger(OneHealthService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
    private readonly configService: ConfigService,
  ) {}

  async recordExposure(
    tenantId: string,
    patientId: string,
    recordedBy: string,
    dto: Partial<AnimalExposure>,
  ): Promise<{ exposure: AnimalExposure; zoonoticAssessment: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(AnimalExposure);
    const exposure = repo.create({
      ...dto,
      patientId,
      recordedBy,
      recordedDate: dto.recordedDate ?? new Date().toISOString().slice(0, 10),
    } as Partial<AnimalExposure>);
    const saved = (await repo.save(exposure)) as AnimalExposure;

    let zoonoticAssessment: Record<string, any> = {};
    try {
      zoonoticAssessment = await this.cdssService.zoonoticAssess(
        {
          animal_type: saved.animalType,
          exposure_type: saved.exposureType,
          exposure_date: saved.exposureDate ?? undefined,
          animal_ill: saved.animalIll ?? undefined,
          animal_vaccinated: saved.animalVaccinated ?? undefined,
          exposure_location: saved.exposureLocation ?? undefined,
        },
        tenantId,
      );
    } catch (error: any) {
      this.logger.warn(`Zoonotic assess failed for exposure ${saved.id}: ${error?.message}`);
    }

    return { exposure: saved, zoonoticAssessment };
  }

  async getExposures(tenantId: string, patientId: string): Promise<AnimalExposure[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(AnimalExposure).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async createReport(
    tenantId: string,
    patientId: string,
    reportedBy: string,
    dto: Partial<OneHealthReport>,
  ): Promise<OneHealthReport> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OneHealthReport);
    const entity = repo.create({
      ...dto,
      patientId,
      reportedBy,
      reportDate: dto.reportDate ?? new Date().toISOString().slice(0, 10),
      labEvidence: dto.labEvidence ?? {},
    } as Partial<OneHealthReport>);
    return (await repo.save(entity)) as OneHealthReport;
  }

  async submitToVetAuthority(tenantId: string, reportId: string): Promise<OneHealthReport> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(OneHealthReport);
    const report = await repo.findOneByOrFail({ id: reportId });

    const vetBaseUrl = this.configService.get<string>('VET_AUTHORITY_BASE_URL');
    const vetApiKey = this.configService.get<string>('VET_AUTHORITY_API_KEY');

    if (vetBaseUrl) {
      try {
        const { data } = await axios.post(
          `${vetBaseUrl.replace(/\/$/, '')}/api/one-health-report`,
          {
            patientId: report.patientId,
            suspectedZoonosis: report.suspectedZoonosis,
            icd11Code: report.icd11Code,
            reportDate: report.reportDate,
            clinicalSummary: report.clinicalSummary,
            labEvidence: report.labEvidence,
          },
          {
            headers: {
              ...(vetApiKey ? { Authorization: `Bearer ${vetApiKey}` } : {}),
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          },
        );
        await repo.update(reportId, {
          submittedToVetAuthority: true,
          vetAuthorityReference: data?.reference ?? data?.id ?? null,
          submittedAt: new Date(),
        });
      } catch (error: any) {
        await repo.update(reportId, { submittedToVetAuthority: false });
        throw new Error(`Vet authority submission failed: ${error?.message}. Report saved locally.`);
      }
    } else {
      await repo.update(reportId, {
        submittedToVetAuthority: true,
        submittedAt: new Date(),
        vetAuthorityReference: `LOCAL-${Date.now()}`,
      });
    }

    return await repo.findOneByOrFail({ id: reportId });
  }

  async getReports(tenantId: string, patientId: string): Promise<OneHealthReport[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(OneHealthReport).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async startRabiesPep(
    tenantId: string,
    patientId: string,
    administeredBy: string,
    exposureDate: string,
    protocol: 'essen' | 'zagreb' = 'essen',
    weightKg?: number,
    facilityId?: string,
  ): Promise<{ pepSchedule: PepScheduleItem[] }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(ImmunizationRecord);

    const essenDays = [0, 3, 7, 14, 28];
    const zagrebDays = [0, 0, 7, 21];
    const scheduleDays = protocol === 'zagreb' ? zagrebDays : essenDays;
    const base = new Date(exposureDate);
    const today = new Date().toISOString().slice(0, 10);
    const pepSchedule: PepScheduleItem[] = [];

    for (let i = 0; i < scheduleDays.length; i += 1) {
      const doseDate = new Date(base);
      doseDate.setDate(base.getDate() + scheduleDays[i]);
      const scheduledDate = doseDate.toISOString().slice(0, 10);
      const isDose0 = i === 0 || (protocol === 'zagreb' && i === 1 && scheduleDays[i] === 0);
      const status: PepScheduleItem['status'] = isDose0 ? 'given' : scheduledDate < today ? 'missed' : 'given';

      const record = repo.create({
        patientId,
        vaccineName: 'Rabies vaccine (HDCV/PCECV/PVRV)',
        doseNumber: i + 1,
        administeredAt: isDose0 ? new Date() : doseDate,
        administeredBy: isDose0 ? administeredBy : undefined,
        route: 'IM',
        site: 'deltoid',
        doseMl: 1.0,
        facilityId: facilityId ?? undefined,
        status,
        notes: `Rabies PEP - ${protocol === 'zagreb' ? 'Zagreb 4-dose' : 'Essen 5-dose'} protocol. Day ${scheduleDays[i]}. Exposure date: ${exposureDate}.${weightKg ? ` Weight: ${weightKg}kg.` : ''}`,
      } as Partial<ImmunizationRecord>);

      await repo.save(record);
      pepSchedule.push({ doseNumber: i + 1, scheduledDate, status });
    }

    await this.markLatestExposurePepStarted(db, patientId, exposureDate);
    return { pepSchedule };
  }

  async getRabiesPepStatus(tenantId: string, patientId: string): Promise<ImmunizationRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(ImmunizationRecord).find({
      where: { patientId, vaccineName: 'Rabies vaccine (HDCV/PCECV/PVRV)' },
      order: { doseNumber: 'ASC' },
    });
  }

  async assessZoonotic(tenantId: string, payload: Record<string, any>): Promise<Record<string, any>> {
    return this.cdssService.zoonoticAssess(payload, tenantId);
  }

  private async markLatestExposurePepStarted(db: DataSource, patientId: string, exposureDate?: string): Promise<void> {
    const repo = db.getRepository(AnimalExposure);
    const exposure = await repo
      .createQueryBuilder('exposure')
      .where('exposure.patient_id = :patientId', { patientId })
      .andWhere(exposureDate ? 'exposure.exposure_date = :exposureDate' : '1=1', exposureDate ? { exposureDate } : {})
      .orderBy('exposure.exposure_date', 'DESC', 'NULLS LAST')
      .addOrderBy('exposure.created_at', 'DESC')
      .getOne();

    if (exposure) {
      await repo.update({ id: exposure.id }, { rabiesPepStarted: true });
    }
  }
}
