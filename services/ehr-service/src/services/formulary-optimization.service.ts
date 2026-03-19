import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { FormularyAiSuggestion } from '../entities/formulary-ai-suggestion.entity';
import axios from 'axios';

@Injectable()
export class FormularyOptimizationService {
  private readonly logger = new Logger(FormularyOptimizationService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  constructor(private readonly tenantService: TenantService) {}

  /**
   * Called on every new prescription. Fire-and-forget.
   */
  async optimizeOnPrescription(subdomain: string, prescriptionId: string, patientId: string, drugName: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    let suggestion: Partial<FormularyAiSuggestion> = {
      prescriptionId, patientId, brandedDrug: drugName,
      aiRecommendation: 'no_substitute', reason: 'No generic alternative found',
    };

    try {
      const { data } = await axios.post(`${this.cdssUrl}/formulary/optimize`, { drug: drugName, patientId });
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

  async getSuggestions(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FormularyAiSuggestion).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async respondToSuggestion(subdomain: string, id: string, accepted: boolean) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(FormularyAiSuggestion);
    await repo.update(id, { accepted });
    return repo.findOneBy({ id });
  }

  async cdssOptimize(payload: any) {
    const { data } = await axios.post(`${this.cdssUrl}/formulary/optimize`, payload);
    return data;
  }
}
