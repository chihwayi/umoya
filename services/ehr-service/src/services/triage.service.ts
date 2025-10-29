import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TriageAssessment } from '../entities/triage-assessment.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class TriageService {
  constructor(private tenantService: TenantService) {}

  private async getRepository(tenantId: string): Promise<Repository<TriageAssessment>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(TriageAssessment);
  }

  async recordAssessment(data: Partial<TriageAssessment>, tenantId: string): Promise<TriageAssessment> {
    const repo = await this.getRepository(tenantId);
    const entity = repo.create(data as TriageAssessment);
    return repo.save(entity);
  }

  async getByPatient(patientId: string, tenantId: string): Promise<TriageAssessment[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }
}


