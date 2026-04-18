import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PlagueCase } from './entities/plague-case.entity';
import { YellowFeverCase } from './entities/yellow-fever-case.entity';
import { MeningitisCase } from './entities/meningitis-case.entity';
import { TenantService } from '../services/tenant.service';

@Injectable()
export class OutbreakProtocolService {
  private readonly logger = new Logger(OutbreakProtocolService.name);

  constructor(private tenantService: TenantService) {}

  private async getRepository<T>(tenantId: string, entity: any): Promise<Repository<T>> {
    const dataSource = await this.tenantService.getTenantDatabase(tenantId);
    if (!dataSource) throw new Error(`Could not connect to tenant database for ${tenantId}`);
    return dataSource.getRepository(entity);
  }

  // ── Plague ─────────────────────────────────────────────────────────────────

  async createPlagueCase(tenantId: string, data: Partial<PlagueCase>): Promise<PlagueCase> {
    const repo = await this.getRepository<PlagueCase>(tenantId, PlagueCase);
    const plagueCase = repo.create(data);
    return repo.save(plagueCase);
  }

  async getPlagueCases(tenantId: string, patientId?: string): Promise<PlagueCase[]> {
    const repo = await this.getRepository<PlagueCase>(tenantId, PlagueCase);
    return repo.find({ where: patientId ? { patientId } : {}, order: { dateReported: 'DESC' } });
  }

  // ── Yellow Fever ───────────────────────────────────────────────────────────

  async createYellowFeverCase(tenantId: string, data: Partial<YellowFeverCase>): Promise<YellowFeverCase> {
    const repo = await this.getRepository<YellowFeverCase>(tenantId, YellowFeverCase);
    const yellowFeverCase = repo.create(data);
    return repo.save(yellowFeverCase);
  }

  async getYellowFeverCases(tenantId: string, patientId?: string): Promise<YellowFeverCase[]> {
    const repo = await this.getRepository<YellowFeverCase>(tenantId, YellowFeverCase);
    return repo.find({ where: patientId ? { patientId } : {}, order: { dateReported: 'DESC' } });
  }

  // ── Meningitis ─────────────────────────────────────────────────────────────

  async createMeningitisCase(tenantId: string, data: Partial<MeningitisCase>): Promise<MeningitisCase> {
    const repo = await this.getRepository<MeningitisCase>(tenantId, MeningitisCase);
    const meningitisCase = repo.create(data);
    return repo.save(meningitisCase);
  }

  async getMeningitisCases(tenantId: string, patientId?: string): Promise<MeningitisCase[]> {
    const repo = await this.getRepository<MeningitisCase>(tenantId, MeningitisCase);
    return repo.find({ where: patientId ? { patientId } : {}, order: { dateReported: 'DESC' } });
  }
}
