import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Allergy } from '../entities/allergy.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class AllergyService {
  constructor(private tenantService: TenantService) {}

  private async repo(tenantId: string): Promise<Repository<Allergy>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(Allergy);
  }

  async findByPatient(patientId: string, tenantId: string) {
    try {
      const r = await this.repo(tenantId);
      return r.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
    } catch (e) {
      return [];
    }
  }

  async replaceForPatient(patientId: string, items: Partial<Allergy>[], userId: string, tenantId: string) {
    try {
      const r = await this.repo(tenantId);
      await r.delete({ patientId });
      const toSave = items.map(i => r.create({
        patientId,
        allergen: i.allergen || '',
        reaction: i.reaction || null,
        severity: (i.severity as any) || null,
        recordedBy: userId,
      }));
      return r.save(toSave);
    } catch (e) {
      return [] as any;
    }
  }
}


