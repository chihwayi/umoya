import { Injectable, Logger, Optional } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { TriageAssessment } from '../entities/triage-assessment.entity';
import { TenantService } from './tenant.service';
import { AllergyService } from './allergy.service';
import { TerminologyService } from './terminology.service';
import { CdssHookService } from './cdss-hook.service';
import { ClinicalWorkflowService } from './clinical-workflow.service';

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private tenantService: TenantService,
    private allergyService: AllergyService,
    private terminologyService: TerminologyService,
    private cdssHookService: CdssHookService,
    @Optional() private workflowService?: ClinicalWorkflowService,
  ) {}

  private async getRepository(tenantId: string): Promise<Repository<TriageAssessment>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(TriageAssessment);
  }

  /**
   * Parse allergies text into structured allergy objects
   * Supports formats like: "Penicillin (rash)", "Aspirin: severe", "None", "NKDA"
   */
  private parseAllergiesText(
    allergiesText: string,
  ): Array<{ allergen: string; reaction?: string; severity?: 'mild' | 'moderate' | 'severe' }> {
    if (!allergiesText || !allergiesText.trim()) {
      return [];
    }

    const normalized = allergiesText.trim().toUpperCase();
    
    // Handle common "no allergies" indicators
    if (normalized === 'NONE' || normalized === 'NKA' || normalized === 'NKDA' || normalized === 'NO KNOWN ALLERGIES') {
      return [];
    }

    const allergies: Array<{ allergen: string; reaction?: string; severity?: 'mild' | 'moderate' | 'severe' }> = [];
    const lines = allergiesText.split(/[,;\n\r]+/).map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      if (!line) continue;

      let allergen = line;
      let reaction: string | undefined;
      let severity: string | undefined;

      // Try to extract reaction and severity from patterns like:
      // "Penicillin (rash)" or "Aspirin: severe" or "Latex - severe reaction"
      const parenMatch = line.match(/^(.+?)\s*\((.+?)\)$/);
      const colonMatch = line.match(/^(.+?):\s*(.+)$/);
      const dashMatch = line.match(/^(.+?)\s*-\s*(.+)$/);

      if (parenMatch) {
        allergen = parenMatch[1].trim();
        const details = parenMatch[2].trim();
        // Check if it's severity or reaction
        if (['mild', 'moderate', 'severe'].includes(details.toLowerCase())) {
          severity = details.toLowerCase();
        } else {
          reaction = details;
        }
      } else if (colonMatch) {
        allergen = colonMatch[1].trim();
        const details = colonMatch[2].trim();
        if (['mild', 'moderate', 'severe'].includes(details.toLowerCase())) {
          severity = details.toLowerCase();
        } else {
          reaction = details;
        }
      } else if (dashMatch) {
        allergen = dashMatch[1].trim();
        const details = dashMatch[2].trim();
        if (details.toLowerCase().includes('severe')) {
          severity = 'severe';
          reaction = details;
        } else if (details.toLowerCase().includes('moderate')) {
          severity = 'moderate';
          reaction = details;
        } else if (details.toLowerCase().includes('mild')) {
          severity = 'mild';
          reaction = details;
        } else {
          reaction = details;
        }
      }

      if (allergen) {
        allergies.push({
          allergen: allergen.trim(),
          reaction: reaction || undefined,
          severity: (severity as 'mild' | 'moderate' | 'severe' | undefined) || undefined,
        });
      }
    }

    return allergies;
  }

  private extractConceptId(candidate: any): string | null {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
    return (
      candidate?.conceptId ??
      candidate?.snomedConceptId ??
      candidate?.snomed_code ??
      candidate?.snomedCode ??
      candidate?.code ??
      null
    );
  }

  private async resolveConcept(
    tenantDb: DataSource,
    raw: any,
  ): Promise<StoredConceptSummary | null> {
    if (raw === undefined || raw === null) {
      return null;
    }

    const conceptIdCandidate = this.extractConceptId(raw);
    if (!conceptIdCandidate) {
      return null;
    }

    const conceptId = String(conceptIdCandidate).trim();
    let validated:
      | {
          conceptId: string;
          preferredTerm?: string;
          term?: string;
          moduleId?: string;
          definitionStatus?: string;
        }
      | null = null;

    if (/^\d+$/.test(conceptId)) {
      try {
        validated = await this.terminologyService.validateConcept(tenantDb, conceptId);
      } catch (error: any) {
        this.logger.warn(
          `SNOMED validation failed for concept "${conceptId}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for triage payload.`);
      return null;
    }

    const rawTerm =
      (typeof raw === 'object' && (raw.preferredTerm || raw.term || raw.fullySpecifiedName)) ||
      null;
    const term = rawTerm ?? validated?.preferredTerm ?? validated?.term ?? null;

    if (!term && !validated) {
      return null;
    }

    return {
      conceptId: validated?.conceptId ?? conceptId,
      term: term ?? '',
      moduleId: validated?.moduleId ?? raw?.moduleId,
      definitionStatus: validated?.definitionStatus ?? raw?.definitionStatus,
    };
  }

  private async normalizeConceptArray(
    tenantDb: DataSource,
    rawList: any,
  ): Promise<StoredConceptSummary[]> {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return [];
    }

    const normalized: StoredConceptSummary[] = [];
    for (const entry of rawList) {
      const resolved = await this.resolveConcept(tenantDb, entry);
      if (resolved) {
        normalized.push(resolved);
      }
    }
    return normalized;
  }

  async recordAssessment(data: Partial<TriageAssessment>, tenantId: string): Promise<TriageAssessment> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Resolve SNOMED concepts
    const chiefComplaintConcept = await this.resolveConcept(tenantDb, data.chiefComplaintSnomedCode || (data as any).chief_complaint_snomed);
    const observationsList = await this.normalizeConceptArray(tenantDb, (data as any).observations_snomed || data.observationsSnomed);

    // Use raw SQL to insert with SNOMED fields
    const result = await tenantDb.query(
      `
      INSERT INTO triage_assessments (
        patient_id, chief_complaint, chief_complaint_snomed_code, chief_complaint_snomed_term,
        chief_complaint_snomed_module_id, chief_complaint_snomed_definition_status,
        onset, pain_score, allergies, medications, history, observations, observations_snomed,
        priority, severity_score, recorded_at, recorded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17)
      RETURNING *
      `,
      [
        data.patientId,
        data.chiefComplaint,
        chiefComplaintConcept?.conceptId ?? null,
        chiefComplaintConcept?.term ?? null,
        chiefComplaintConcept?.moduleId ?? null,
        chiefComplaintConcept?.definitionStatus ?? null,
        data.onset ?? null,
        data.painScore ?? null,
        data.allergies ?? null,
        data.medications ?? null,
        data.history ?? null,
        data.observations ?? null,
        JSON.stringify(observationsList),
        data.priority,
        data.severityScore ?? null,
        data.recordedAt ?? new Date(),
        data.recordedBy,
      ],
    );

    const saved = result[0];

    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handleTriageAssessment({
        tenantId,
        tenantDb,
        assessment: saved,
        chiefComplaintConcept,
        observationConcepts: observationsList,
      });
    } catch (error) {
      this.logger.warn(`CDSS hook failed for triage assessment: ${error instanceof Error ? error.message : error}`);
    }

    // Sync allergies from triage text to structured allergies table
    if (data.allergies && data.patientId && data.recordedBy) {
      try {
        const parsedAllergies = this.parseAllergiesText(data.allergies);
        
        // Only update if there are actually parsed allergies (avoid clearing existing)
        // If text is empty or "none", we don't overwrite existing structured allergies
        if (parsedAllergies.length > 0) {
          await this.allergyService.replaceForPatient(
            data.patientId as string,
            parsedAllergies,
            data.recordedBy as string,
            tenantId
          );
        }
      } catch (e) {
        // Log but don't fail triage save if allergy sync fails
        console.error('Failed to sync allergies from triage:', e);
      }
    }

    // Trigger workflow for triage_completed
    if (this.workflowService) {
      try {
        await this.workflowService.executeWorkflow(
          'triage_completed',
          {
            entityType: 'triage_assessment',
            entityId: saved.id,
            patientId: saved.patient_id,
            data: {
              priority: saved.priority,
              severityScore: saved.severity_score,
              chiefComplaint: saved.chief_complaint,
            },
          },
          tenantDb,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for triage_completed: ${error instanceof Error ? error.message : error}`);
      }
    }

    return {
      ...saved,
      cdssInsights,
    };
  }

  async getByPatient(patientId: string, tenantId: string): Promise<TriageAssessment[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }
}
