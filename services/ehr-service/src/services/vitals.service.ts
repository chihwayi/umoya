import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Vitals } from '../entities/vitals.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class VitalsService {
  constructor(private tenantService: TenantService) {}

  private async getRepository(tenantId: string): Promise<Repository<Vitals>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(Vitals);
  }

  async recordVitals(data: Partial<Vitals>, tenantId: string): Promise<Vitals> {
    const repo = await this.getRepository(tenantId);
    const entity = repo.create(data as Vitals);
    return repo.save(entity);
  }

  async getByPatient(patientId: string, tenantId: string): Promise<Vitals[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }
}


