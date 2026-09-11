import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { FormularyAiSuggestion } from '../entities/formulary-ai-suggestion.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class FormularyOptimizationService {
  private readonly logger = new Logger(FormularyOptimizationService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  /**
   * Called on every new prescription. Fire-and-forget.
   */
  async optimizeOnPrescription(tenantId: string, ds: DataSource, prescriptionId: string, patientId: string, drugName: string) {
    let suggestion: Partial<FormularyAiSuggestion> = {
      prescriptionId, patientId, brandedDrug: drugName,
      aiRecommendation: 'no_substitute', reason: 'No generic alternative found',
    };

    try {
      const data = await this.cdssService.optimizeFormulary(
        {
          patientId,
          prescriptionId,
          brandedDrug: drugName,
          diagnoses: [],
        },
        tenantId,
        ds,
      );
      suggestion = {
        ...suggestion,
        genericAlternative: data.generic_alternative,
        brandedCost: data.branded_cost,
        genericCost: data.generic_cost,
        savingAmount: data.saving_amount,
        medicalAidCoverage: data.medical_aid_coverage ?? false,
        medicalAidTier: data.medical_aid_tier,
        evidenceEquivalence: data.evidence_equivalence,
        aiRecommendation: data.recommendation || 'no_substitute',
        reason: data.reason,
      };
    } catch (e: any) {
      this.logger.warn(`Formulary optimization failed for ${drugName}: ${e?.message}`);
    }

    const repo = ds.getRepository(FormularyAiSuggestion);
    return repo.save(repo.create(suggestion as FormularyAiSuggestion));
  }

  async getSuggestions(ds: DataSource, patientId: string) {
    return ds.getRepository(FormularyAiSuggestion).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async respondToSuggestion(ds: DataSource, id: string, accepted: boolean) {
    const repo = ds.getRepository(FormularyAiSuggestion);
    await repo.update(id, { accepted });
    return repo.findOneBy({ id });
  }

  async cdssOptimize(payload: any) {
    return this.cdssService.optimizeFormulary(payload);
  }
}
