import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { NcdComplicationEvent } from '../entities/ncd-complication-event.entity';

@Injectable()
export class NcdComplicationsService {
  constructor(private readonly tenantService: TenantService) {}

  async recordComplicationEvent(
    tenantId: string,
    patientId: string,
    recordedBy: string,
    dto: Partial<NcdComplicationEvent>,
  ): Promise<NcdComplicationEvent> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(NcdComplicationEvent);
    const entity = repo.create({
      ...dto,
      patientId,
      recordedBy,
      eventDate: dto.eventDate ?? new Date().toISOString().slice(0, 10),
      severity: dto.severity ?? 'MODERATE',
    } as Partial<NcdComplicationEvent>);
    return repo.save(entity) as unknown as NcdComplicationEvent;
  }

  async getComplicationEvents(tenantId: string, patientId: string): Promise<NcdComplicationEvent[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(NcdComplicationEvent).find({
      where: { patientId },
      order: { eventDate: 'DESC', createdAt: 'DESC' },
    });
  }
}
