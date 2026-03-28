import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { FormIntelligenceConfig } from '../entities/form-intelligence-config.entity';
import { CdssService } from './cdss.service';

interface PatientContext {
  age?: number;
  sex?: string;
  diagnoses?: string[];
  medications?: string[];
  vitals?: Record<string, any>;
  pregnancyStatus?: string;
}

@Injectable()
export class SmartDefaultsService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Form Intelligence Configs ─────────────────────────────────────────────

  async upsertConfig(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(FormIntelligenceConfig);
    const existing = await repo.findOne({ where: { formName: dto.formName } });
    if (existing) {
      await repo.update(existing.id, { ...dto, version: existing.version + 1 });
      return repo.findOneBy({ id: existing.id });
    }
    return repo.save(repo.create(dto));
  }

  async getConfig(subdomain: string, formName: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FormIntelligenceConfig).findOne({ where: { formName, isActive: true } });
  }

  async listConfigs(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FormIntelligenceConfig).find({ where: { isActive: true } });
  }

  // ── Smart Defaults Engine ─────────────────────────────────────────────────

  async getDefaults(subdomain: string, formName: string, context: PatientContext) {
    const config = await this.getConfig(subdomain, formName);
    const defaults: Record<string, { value: any; confidence: number; source: string }> = {};

    // Apply rule-based defaults from config
    if (config) {
      for (const rule of config.defaultRules || []) {
        if (this.evaluateCondition(rule.condition, context)) {
          defaults[rule.field] = { value: rule.value, confidence: rule.confidence || 0.8, source: 'rule' };
        }
      }
    }

    // Built-in universal rules
    if (context.age && context.age < 18) {
      defaults['weight_based_dosing'] = { value: true, confidence: 1.0, source: 'builtin' };
    }
    if (context.sex === 'female' && context.age && context.age >= 12 && context.age <= 55) {
      defaults['show_pregnancy_status'] = { value: true, confidence: 0.95, source: 'builtin' };
    }
    if (context.diagnoses?.some(d => d.includes('T2DM') || d.includes('E11'))) {
      defaults['glucose_unit'] = { value: 'mmol/L', confidence: 0.9, source: 'builtin' };
      defaults['show_hba1c_trend'] = { value: true, confidence: 0.95, source: 'builtin' };
    }
    if (context.vitals?.systolic && context.vitals.systolic > 160) {
      defaults['trigger_hypertension_care_gap'] = { value: true, confidence: 1.0, source: 'builtin' };
    }

    return defaults;
  }

  async getVisibility(subdomain: string, formName: string, context: PatientContext) {
    const config = await this.getConfig(subdomain, formName);
    const visibility: Record<string, boolean> = {};
    for (const rule of config?.visibilityRules || []) {
      if (this.evaluateCondition(rule.condition, context)) {
        visibility[rule.field] = rule.action === 'show';
      }
    }
    return visibility;
  }

  // ── CDSS ──────────────────────────────────────────────────────────────────

  async aiSuggestDefaults(subdomain: string, payload: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return this.cdssService.suggestFormDefaults(payload, subdomain, ds);
  }

  private evaluateCondition(condition: any, context: PatientContext): boolean {
    if (!condition) return true;
    if (condition.age_min && (!context.age || context.age < condition.age_min)) return false;
    if (condition.age_max && (!context.age || context.age > condition.age_max)) return false;
    if (condition.sex && context.sex !== condition.sex) return false;
    if (condition.diagnosis_includes && !context.diagnoses?.some(d => d.includes(condition.diagnosis_includes))) return false;
    return true;
  }
}
