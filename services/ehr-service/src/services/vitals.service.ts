import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Vitals } from '../entities/vitals.entity';
import { TenantService } from './tenant.service';
import { CdssHookService } from './cdss-hook.service';

@Injectable()
export class VitalsService {
  private readonly logger = new Logger(VitalsService.name);

  constructor(
    private tenantService: TenantService,
    private cdssHookService: CdssHookService,
  ) {}

  private async getRepository(tenantId: string): Promise<Repository<Vitals>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(Vitals);
  }

  async recordVitals(data: Partial<Vitals>, tenantId: string): Promise<Vitals & { cdssInsights?: any }> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    const repo = tenantDb.getRepository(Vitals);
    const entity = repo.create(data as Vitals);
    const saved = await repo.save(entity);

    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handleVitalsRecorded({
        tenantId,
        tenantDb,
        vitals: saved,
      });
    } catch (error) {
      this.logger.warn(`CDSS hook failed for vitals: ${error instanceof Error ? error.message : error}`);
    }

    return {
      ...saved,
      cdssInsights,
    };
  }

  async getByPatient(patientId: string, tenantId: string): Promise<Vitals[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }
}


