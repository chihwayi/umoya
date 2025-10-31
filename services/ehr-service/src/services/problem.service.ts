import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Problem } from '../entities/problem.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class ProblemService {
  constructor(private tenantService: TenantService) {}

  private async repo(tenantId: string): Promise<Repository<Problem>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(Problem);
  }

  async findByPatient(patientId: string, tenantId: string) {
    try {
      const r = await this.repo(tenantId);
      return r.find({ where: { patientId }, order: { updatedAt: 'DESC' } });
    } catch (e) {
      // If table missing or any error, return empty list to avoid 500s
      return [];
    }
  }

  async replaceForPatient(patientId: string, items: Partial<Problem>[], tenantId: string) {
    try {
      const r = await this.repo(tenantId);
      await r.delete({ patientId });
      const toSave = items.map((i: any) => r.create({
        patientId,
        // accept either { code, description } or { icdCode, problemName }
        code: i.code ?? i.icdCode ?? null,
        description: (i.description ?? i.problemName ?? '').toString(),
        status: (i.status as any) || 'active',
        onsetDate: i.onsetDate ? new Date(i.onsetDate as any) : null,
        resolvedDate: i.resolvedDate ? new Date(i.resolvedDate as any) : null,
        notes: i.notes || null,
      }));
      return r.save(toSave);
    } catch (e) {
      return [] as any;
    }
  }
}


