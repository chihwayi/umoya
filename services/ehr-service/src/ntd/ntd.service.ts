import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LeprosyCase } from './entities/leprosy-case.entity';
import { OnchocerciasisCase } from './entities/onchocerciasis-case.entity';
import { FilariasisCase } from './entities/filariasis-case.entity';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';

@Injectable()
export class NtdService {
  private readonly logger = new Logger(NtdService.name);

  constructor(
    private tenantService: TenantService,
    private cdssService: CdssService,
  ) {}

  private async getRepository<T>(tenantId: string, entity: any): Promise<Repository<T>> {
    const dataSource = await this.tenantService.getTenantDatabase(tenantId);
    if (!dataSource) throw new Error(`Could not connect to tenant database for ${tenantId}`);
    return dataSource.getRepository(entity);
  }

  // ── Leprosy ────────────────────────────────────────────────────────────────

  async createLeprosyCase(tenantId: string, data: Partial<LeprosyCase>): Promise<LeprosyCase> {
    const repo = await this.getRepository<LeprosyCase>(tenantId, LeprosyCase);
    const leprosyCase = repo.create(data);
    return repo.save(leprosyCase);
  }

  async getLeprosyCases(tenantId: string, patientId?: string): Promise<LeprosyCase[]> {
    const repo = await this.getRepository<LeprosyCase>(tenantId, LeprosyCase);
    return repo.find({ where: patientId ? { patientId } : {}, order: { registrationDate: 'DESC' } });
  }

  async getLeprosyMdtGuidance(tenantId: string, payload: any): Promise<any> {
    return this.cdssService.ntdLeprosyMdt(payload, tenantId);
  }

  // ── Onchocerciasis ──────────────────────────────────────────────────────────

  async createOnchocerciasisCase(tenantId: string, data: Partial<OnchocerciasisCase>): Promise<OnchocerciasisCase> {
    const repo = await this.getRepository<OnchocerciasisCase>(tenantId, OnchocerciasisCase);
    const onchoCase = repo.create(data);
    return repo.save(onchoCase);
  }

  async getOnchocerciasisCases(tenantId: string, patientId?: string): Promise<OnchocerciasisCase[]> {
    const repo = await this.getRepository<OnchocerciasisCase>(tenantId, OnchocerciasisCase);
    return repo.find({ where: patientId ? { patientId } : {}, order: { registrationDate: 'DESC' } });
  }

  // ── Filariasis ──────────────────────────────────────────────────────────────

  async createFilariasisCase(tenantId: string, data: Partial<FilariasisCase>): Promise<FilariasisCase> {
    const repo = await this.getRepository<FilariasisCase>(tenantId, FilariasisCase);
    
    // Auto-check safety if Loa loa mf count is present
    if (data.loaLoaMfCount !== undefined) {
        try {
            const safety = await this.cdssService.ntdFilariasisSafety({
                disease_type: data.diseaseType,
                loa_loa_mf_count: data.loaLoaMfCount,
                age_years: 30, // Default for check if not provided
                weight_kg: 60,
            }, tenantId);
            data.treatmentSafe = safety.ivermectin_safe && safety.dec_safe;
            data.treatmentContraindication = safety.contraindications.join('; ');
        } catch (e) {
            this.logger.warn(`Filariasis safety check failed: ${e.message}`);
        }
    }

    const filariasisCase = repo.create(data);
    return repo.save(filariasisCase);
  }

  async getFilariasisCases(tenantId: string, patientId?: string): Promise<FilariasisCase[]> {
    const repo = await this.getRepository<FilariasisCase>(tenantId, FilariasisCase);
    return repo.find({ where: patientId ? { patientId } : {}, order: { registrationDate: 'DESC' } });
  }

  async checkFilariasisSafety(tenantId: string, payload: any): Promise<any> {
    return this.cdssService.ntdFilariasisSafety(payload, tenantId);
  }
}
