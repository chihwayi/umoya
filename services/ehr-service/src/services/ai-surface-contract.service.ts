import { Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { HipaaAuditService } from './hipaa-audit.service';

export interface AiSurfaceContractDefinition {
  aiSurface: string;
  displayName: string;
  description: string;
  useCases: string[];
  monitoring: {
    metricsSurface: string;
    offlineEvalSupported: boolean;
    releaseGateSupported: boolean;
  };
  audit: {
    modelRegistry: string;
    promptAuditLog: string;
    sourceOfTruth: string;
  };
  controls: {
    disablePaths: string[];
    rollbackPaths: string[];
  };
}

export interface RecordAiSurfaceExecutionInput {
  tenantDb?: DataSource;
  tenantId?: string | null;
  aiSurface: string;
  useCase: string;
  source: string;
  modelId?: string | null;
  modelVersion?: string | null;
  provider?: string | null;
  patientId?: string | null;
  encounterId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  latencyMs?: number | null;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  safetyGateTriggered?: boolean;
  requestBody?: Record<string, any>;
  responseSummary?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AiSurfaceExecutionMetadata {
  aiSurface: string;
  useCase: string;
  provenance: {
    modelId: string;
    modelVersion: string;
    provider: string;
    source: string;
  };
  audit: {
    modelRegistry: string;
    promptAuditLog: string;
    requestId: string | null;
    recorded: boolean;
  };
  monitoring: {
    metricsSurface: string;
    offlineEvalSupported: boolean;
    releaseGateSupported: boolean;
  };
  controls: {
    disablePaths: string[];
    rollbackPaths: string[];
  };
}

const AI_SURFACE_CONTRACTS: Record<string, AiSurfaceContractDefinition> = {
  cdss_diagnosis: {
    aiSurface: 'cdss_diagnosis',
    displayName: 'CDSS Diagnosis',
    description: 'Governed clinical reasoning, diagnosis support, and guideline-grounded CDSS responses.',
    useCases: ['intelligent_diagnosis', 'guideline_analysis', 'patient_summarization'],
    monitoring: {
      metricsSurface: 'cdss_diagnosis',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'CdssService governed prompt audit + CDSS model registry',
    },
    controls: {
      disablePaths: ['CDSS_ENABLE_AI', 'tenant AI use-case policy', 'LLM vendor/model registry disable'],
      rollbackPaths: ['model-monitoring release readiness', 'CDSS model registry status', 'tenant policy disable'],
    },
  },
  proactive_ai: {
    aiSurface: 'proactive_ai',
    displayName: 'Proactive AI',
    description: 'Longitudinal patient analysis that generates cached AI snapshots, risk trends, and alerts.',
    useCases: ['patient_proactive_analysis'],
    monitoring: {
      metricsSurface: 'proactive_ai',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'Patient AI snapshots + governed prompt audit',
    },
    controls: {
      disablePaths: ['CDSS_ENABLE_AI', 'tenant AI policy disable'],
      rollbackPaths: ['model-monitoring release readiness', 'CDSS retraining/model version rollback', 'tenant policy disable'],
    },
  },
  risk_tier: {
    aiSurface: 'risk_tier',
    displayName: 'Risk Tier',
    description: 'Patient-level risk stratification output used for longitudinal prioritization and follow-through planning.',
    useCases: ['risk_stratification'],
    monitoring: {
      metricsSurface: 'risk_tier',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'Risk stratification service outputs + governed audit metadata',
    },
    controls: {
      disablePaths: ['tenant AI policy disable', 'risk stratification feature disable'],
      rollbackPaths: ['model-monitoring release readiness', 'risk model rollback', 'tenant policy disable'],
    },
  },
  patient_ai: {
    aiSurface: 'patient_ai',
    displayName: 'Patient AI',
    description: 'Patient-facing symptom checking, adherence guidance, and escalation orchestration.',
    useCases: ['patient_symptom_check', 'patient_adherence_chat'],
    monitoring: {
      metricsSurface: 'patient_ai',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'PatientAiService HIPAA prompt audit + patient AI session artifacts',
    },
    controls: {
      disablePaths: ['CDSS_ENABLE_AI', 'tenant AI use-case policy'],
      rollbackPaths: ['model-monitoring release readiness', 'patient AI route disable', 'tenant policy disable'],
    },
  },
  encounter_copilot: {
    aiSurface: 'encounter_copilot',
    displayName: 'Encounter Copilot',
    description: 'Clinician workflow copilot for contextual summaries, suggested orders, and follow-up tasks.',
    useCases: ['encounter_copilot'],
    monitoring: {
      metricsSurface: 'encounter_copilot',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'Encounter copilot session governance payload + monitoring readiness',
    },
    controls: {
      disablePaths: ['feature toggle / route disable', 'tenant AI policy disable'],
      rollbackPaths: ['model-monitoring release readiness', 'shadow/canary promotion gates', 'feature rollback'],
    },
  },
  radiology_ai: {
    aiSurface: 'radiology_ai',
    displayName: 'Radiology AI',
    description: 'Study-level radiology analysis, critical finding alerts, and radiologist review workflow.',
    useCases: ['radiology_analysis'],
    monitoring: {
      metricsSurface: 'radiology_ai',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'Radiology study findings + governed prompt audit',
    },
    controls: {
      disablePaths: ['CDSS_ENABLE_AI', 'tenant AI policy disable'],
      rollbackPaths: ['model-monitoring release readiness', 'radiology AI model version rollback', 'tenant policy disable'],
    },
  },
  post_visit_grounded_llm: {
    aiSurface: 'post_visit_grounded_llm',
    displayName: 'Post-Visit Grounded LLM',
    description: 'Grounded post-visit drafting, patient answers, escalation classification, and clinician polish flows.',
    useCases: [
      'post_visit_clinical_note',
      'post_visit_referral_letter',
      'post_visit_doctor_polish',
      'post_visit_patient_answer',
      'post_visit_escalation_classification',
    ],
    monitoring: {
      metricsSurface: 'post_visit_grounded_llm',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'PostVisitGroundedLlmService audit metadata + prompt audit log',
    },
    controls: {
      disablePaths: ['POSTVISIT_GROUNDED_LLM_ENABLED', 'tenant AI use-case policy'],
      rollbackPaths: ['model-monitoring release readiness', 'feature flag rollback', 'tenant policy disable'],
    },
  },
  registration_intelligence: {
    aiSurface: 'registration_intelligence',
    displayName: 'Registration Intelligence',
    description: 'Registration document understanding, duplicate review, and intake normalization.',
    useCases: ['registration_document_intelligence'],
    monitoring: {
      metricsSurface: 'registration_intelligence',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'Registration extracts metadata + governed prompt audit',
    },
    controls: {
      disablePaths: ['tenant AI use-case policy', 'feature-level route disable'],
      rollbackPaths: ['model-monitoring release readiness', 'tenant policy disable', 'fallback to heuristic parsing'],
    },
  },
  claims_ai: {
    aiSurface: 'claims_ai',
    displayName: 'Claims AI',
    description: 'Claims denial prediction, appeal drafting, PDMP checks, and financial hardship AI support.',
    useCases: ['claims_denial_prediction', 'claims_appeal_generation', 'pharmacy_pdmp_check', 'financial_hardship'],
    monitoring: {
      metricsSurface: 'claims_ai',
      offlineEvalSupported: true,
      releaseGateSupported: true,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'Claims entities + governed prompt audit',
    },
    controls: {
      disablePaths: ['CDSS_ENABLE_AI', 'tenant AI use-case policy', 'claims workflow feature toggle'],
      rollbackPaths: ['model-monitoring release readiness', 'override/manual review path', 'tenant policy disable'],
    },
  },
  oncology_mobile_intelligence: {
    aiSurface: 'oncology_mobile_intelligence',
    displayName: 'Mobile Oncology Intelligence',
    description: 'Compact oncology protocol intelligence surfaced inside the mobile doctor workflow.',
    useCases: ['oncology_protocol_mobile'],
    monitoring: {
      metricsSurface: 'oncology_mobile_intelligence',
      offlineEvalSupported: false,
      releaseGateSupported: false,
    },
    audit: {
      modelRegistry: 'ai_model_audit_registry',
      promptAuditLog: 'prompt_audit_log',
      sourceOfTruth: 'Oncology protocol bundle snapshot + governed protocol recommendation services',
    },
    controls: {
      disablePaths: ['mobile specialty card disable', 'oncology mobile route disable', 'tenant policy disable'],
      rollbackPaths: ['feature rollback', 'mobile specialty hide', 'fallback to oncology case review'],
    },
  },
};

@Injectable()
export class AiSurfaceContractService {
  constructor(@Optional() private readonly hipaaAuditService?: HipaaAuditService) {}

  listContracts(): AiSurfaceContractDefinition[] {
    return Object.values(AI_SURFACE_CONTRACTS);
  }

  getContract(aiSurface: string): AiSurfaceContractDefinition {
    return AI_SURFACE_CONTRACTS[aiSurface] || {
      aiSurface,
      displayName: aiSurface,
      description: 'Uncatalogued AI surface.',
      useCases: [],
      monitoring: {
        metricsSurface: aiSurface,
        offlineEvalSupported: false,
        releaseGateSupported: false,
      },
      audit: {
        modelRegistry: 'ai_model_audit_registry',
        promptAuditLog: 'prompt_audit_log',
        sourceOfTruth: 'Not yet catalogued',
      },
      controls: {
        disablePaths: ['feature disable'],
        rollbackPaths: ['feature rollback'],
      },
    };
  }

  buildSurfaceMetadata(input: {
    aiSurface: string;
    useCase: string;
    source: string;
    modelId?: string | null;
    modelVersion?: string | null;
    provider?: string | null;
    requestId?: string | null;
    recorded?: boolean;
  }): AiSurfaceExecutionMetadata {
    const contract = this.getContract(input.aiSurface);
    const modelId = String(input.modelId || input.modelVersion || `${input.aiSurface}_model`);
    const modelVersion = String(input.modelVersion || input.modelId || 'unknown');
    const provider = String(input.provider || 'local');

    return {
      aiSurface: contract.aiSurface,
      useCase: input.useCase,
      provenance: {
        modelId,
        modelVersion,
        provider,
        source: input.source,
      },
      audit: {
        modelRegistry: contract.audit.modelRegistry,
        promptAuditLog: contract.audit.promptAuditLog,
        requestId: input.requestId || null,
        recorded: input.recorded === true,
      },
      monitoring: contract.monitoring,
      controls: contract.controls,
    };
  }

  async recordExecution(input: RecordAiSurfaceExecutionInput): Promise<AiSurfaceExecutionMetadata> {
    const requestId = randomUUID();
    const contract = this.getContract(input.aiSurface);
    const modelId = String(input.modelId || input.modelVersion || `${input.aiSurface}_model`);
    const modelVersion = String(input.modelVersion || input.modelId || process.env.CDSS_MODEL_VERSION || 'unknown');
    const provider = String(input.provider || 'local');

    if (!input.tenantDb || !this.hipaaAuditService) {
      return this.buildSurfaceMetadata({
        aiSurface: input.aiSurface,
        useCase: input.useCase,
        source: input.source,
        modelId,
        modelVersion,
        provider,
        requestId,
        recorded: false,
      });
    }

    const promptHash = createHash('sha256')
      .update(JSON.stringify(input.requestBody || {}))
      .digest('hex');

    await this.hipaaAuditService.registerModelEntry(input.tenantDb, {
      modelId,
      modelName: modelId,
      modelVersion,
      provider,
      status: 'active',
      metadata: {
        source: input.source,
        aiSurface: contract.aiSurface,
        useCase: input.useCase,
        tenantId: input.tenantId || null,
      },
    });

    await this.hipaaAuditService.logPromptAudit(input.tenantDb, {
      promptHash,
      templateVersion: `ai-surface-${contract.aiSurface}-v1`,
      modelId,
      patientId: input.patientId || null,
      encounterId: input.encounterId || null,
      actorId: input.actorId || null,
      actorRole: input.actorRole || null,
      latencyMs: Number(input.latencyMs || 0),
      inputTokenCount: Number(input.inputTokenCount || 0),
      outputTokenCount: Number(input.outputTokenCount || 0),
      safetyGateTriggered: input.safetyGateTriggered === true,
      requestId,
      metadata: {
        source: input.source,
        aiSurface: contract.aiSurface,
        useCase: input.useCase,
        tenantId: input.tenantId || null,
        responseSummary: input.responseSummary || {},
        extra: input.metadata || {},
      },
    });

    return this.buildSurfaceMetadata({
      aiSurface: contract.aiSurface,
      useCase: input.useCase,
      source: input.source,
      modelId,
      modelVersion,
      provider,
      requestId,
      recorded: true,
    });
  }
}
