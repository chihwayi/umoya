import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NursingNote } from '../entities/nursing-note.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class NursingNotesService {
  constructor(private tenantService: TenantService) {}

  private async getRepository(tenantId: string): Promise<Repository<NursingNote>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(NursingNote);
  }

  async recordNote(data: Partial<NursingNote>, tenantId: string): Promise<NursingNote> {
    const repo = await this.getRepository(tenantId);
    const entity = repo.create(data as NursingNote);
    return repo.save(entity);
  }

  async getByPatient(patientId: string, tenantId: string): Promise<NursingNote[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }
}


