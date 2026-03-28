import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { AutoCodingSuggestion } from '../entities/auto-coding-suggestion.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class AutoCodingService {
  private readonly logger = new Logger(AutoCodingService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  /**
   * Called after a clinical note is saved. Fire-and-forget from MedicalRecordService.
   */
  async extractAndSaveCodes(subdomain: string, noteId: string, patientId: string, noteText: string, encounterId?: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AutoCodingSuggestion);

    let suggestion: Partial<AutoCodingSuggestion> = {
      noteId, patientId, encounterId, reviewStatus: 'pending', codingModel: 'medspacy-v1',
    };

    try {
      const data = await this.cdssService.extractClinicalCodes(
        {
          noteText,
          patientId,
          noteId,
          encounterId,
        },
        subdomain,
        ds,
      );
      suggestion.suggestedIcd10Codes = data.suggestedIcd10Codes || data.icd10_codes || [];
      suggestion.suggestedCptCodes = data.suggestedCptCodes || data.cpt_codes || [];
      suggestion.codingModel = data.model || 'medspacy-v1';
    } catch (e: any) {
      this.logger.warn(`NLP extract-codes failed for note ${noteId}: ${e?.message}`);
      suggestion.suggestedIcd10Codes = [];
      suggestion.suggestedCptCodes = [];
    }

    // Upsert — one suggestion per note
    const existing = await repo.findOneBy({ noteId });
    if (existing) {
      await repo.update(existing.id, suggestion);
      return repo.findOneBy({ id: existing.id });
    }
    return repo.save(repo.create(suggestion as AutoCodingSuggestion));
  }

  async getSuggestions(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AutoCodingSuggestion).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSuggestionByNote(subdomain: string, noteId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AutoCodingSuggestion).findOneBy({ noteId });
  }

  async reviewSuggestion(subdomain: string, id: string, dto: {
    reviewStatus: string;
    confirmedCodes?: any;
    reviewedBy: string;
  }) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(AutoCodingSuggestion);
    await repo.update(id, {
      reviewStatus: dto.reviewStatus,
      confirmedCodes: dto.confirmedCodes,
      reviewedBy: dto.reviewedBy,
      reviewedAt: new Date(),
    });
    return repo.findOneBy({ id });
  }

  async getPendingReview(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(AutoCodingSuggestion).find({
      where: { reviewStatus: 'pending' },
      order: { createdAt: 'DESC' },
    });
  }
}
