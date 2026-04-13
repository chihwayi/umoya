import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { EpilepsyRegister } from '../entities/epilepsy-register.entity';
import { AedTherapyRecord } from '../entities/aed-therapy-record.entity';
import { AedToxicityEvent } from '../entities/aed-toxicity-event.entity';

@Injectable()
export class EpilepsyService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async enroll(
    tenantId: string,
    patientId: string,
    enrolledBy: string,
    dto: Partial<EpilepsyRegister>,
  ): Promise<EpilepsyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EpilepsyRegister);
    const entity = repo.create({
      ...dto,
      patientId,
      enrolledBy,
      enrolledAt: dto.enrolledAt ?? new Date().toISOString().slice(0, 10),
      pregnancyRiskCounselled: dto.pregnancyRiskCounselled ?? false,
      drivingRestriction: dto.drivingRestriction ?? false,
    } as Partial<EpilepsyRegister>);
    return repo.save(entity) as unknown as EpilepsyRegister;
  }

  async getRegister(tenantId: string, patientId: string): Promise<EpilepsyRegister | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(EpilepsyRegister).findOne({
      where: { patientId },
      order: { enrolledAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateRegister(tenantId: string, id: string, dto: Partial<EpilepsyRegister>): Promise<EpilepsyRegister> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(EpilepsyRegister);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Epilepsy register entry not found');
    }
    await repo.update(id, dto as object);
    return (await repo.findOne({ where: { id } })) as EpilepsyRegister;
  }

  async recordAedTherapy(
    tenantId: string,
    patientId: string,
    recordedBy: string,
    dto: Partial<AedTherapyRecord> & { concurrentDrugs?: string[] | null; isWra?: boolean | null },
  ): Promise<{ aedRecord: AedTherapyRecord; interactionAlerts: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(AedTherapyRecord);
    const register = await this.getRegister(tenantId, patientId);

    let interactionAlerts: Record<string, any> = {
      aed: dto.drugName ?? null,
      interaction_count: 0,
      alerts: [],
      wra_warnings: [],
      has_critical: false,
    };

    if (dto.drugName && Array.isArray(dto.concurrentDrugs) && dto.concurrentDrugs.length > 0) {
      interactionAlerts = await this.cdssService.epilepsyDrugInteractions(
        {
          aed_name: dto.drugName,
          concurrent_drugs: dto.concurrentDrugs,
          is_wra: dto.isWra ?? false,
        },
        tenantId,
      );
    }

    const { concurrentDrugs, isWra, ...aedColumns } = dto;
    const entity = repo.create({
      ...aedColumns,
      patientId,
      epilepsyRegisterId: dto.epilepsyRegisterId ?? register?.id ?? null,
      recordedBy,
    } as Partial<AedTherapyRecord>);
    const aedRecord = await repo.save(entity) as unknown as AedTherapyRecord;
    return { aedRecord, interactionAlerts };
  }

  async getAedTherapy(tenantId: string, patientId: string): Promise<AedTherapyRecord[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(AedTherapyRecord).find({
      where: { patientId },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async stopAedTherapy(tenantId: string, id: string, stopDate: string, stopReason: string): Promise<AedTherapyRecord> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(AedTherapyRecord);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('AED therapy record not found');
    }
    await repo.update(id, {
      stopDate: stopDate || new Date().toISOString().slice(0, 10),
      stopReason: stopReason || null,
    });
    return (await repo.findOne({ where: { id } })) as AedTherapyRecord;
  }

  async recordToxicityEvent(
    tenantId: string,
    patientId: string,
    recordedBy: string,
    dto: Partial<AedToxicityEvent>,
  ): Promise<AedToxicityEvent> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(AedToxicityEvent);
    const entity = repo.create({
      ...dto,
      patientId,
      recordedBy,
      eventDate: dto.eventDate ?? new Date().toISOString().slice(0, 10),
    } as Partial<AedToxicityEvent>);
    return repo.save(entity) as unknown as AedToxicityEvent;
  }

  async getToxicityEvents(tenantId: string, patientId: string): Promise<AedToxicityEvent[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(AedToxicityEvent).find({
      where: { patientId },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async getAedDose(tenantId: string, payload: Record<string, any>): Promise<Record<string, any>> {
    return this.cdssService.epilepsyAedDose(payload, tenantId);
  }

  async checkDrugInteractions(tenantId: string, payload: Record<string, any>): Promise<Record<string, any>> {
    return this.cdssService.epilepsyDrugInteractions(payload, tenantId);
  }

  async getStatusEpilepticusProtocol(tenantId: string, payload: Record<string, any>): Promise<Record<string, any>> {
    return this.cdssService.epilepsyStatusEpilepticus(payload, tenantId);
  }
}
