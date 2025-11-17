import { Injectable, Logger } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { NursingNote } from '../entities/nursing-note.entity';
import { TenantService } from './tenant.service';
import { TerminologyService } from './terminology.service';
import { CdssHookService } from './cdss-hook.service';

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class NursingNotesService {
  private readonly logger = new Logger(NursingNotesService.name);

  constructor(
    private tenantService: TenantService,
    private terminologyService: TerminologyService,
    private readonly cdssHookService: CdssHookService,
  ) {}

  private async getRepository(tenantId: string): Promise<Repository<NursingNote>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(NursingNote);
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
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for nursing note payload.`);
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

  async recordNote(data: Partial<NursingNote>, tenantId: string): Promise<NursingNote> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Resolve SNOMED concepts
    const observationsList = await this.normalizeConceptArray(tenantDb, (data as any).observations_snomed || data.observationsSnomed);
    const interventionsList = await this.normalizeConceptArray(tenantDb, (data as any).interventions_snomed || data.interventionsSnomed);
    const outcomesList = await this.normalizeConceptArray(tenantDb, (data as any).outcomes_snomed || data.outcomesSnomed);

    // Use raw SQL to insert with SNOMED fields
    const result = await tenantDb.query(
      `
      INSERT INTO nursing_notes (
        patient_id, note_type, content, vital_signs, medications,
        observations, observations_snomed, interventions, interventions_snomed,
        outcomes, outcomes_snomed, recorded_at, recorded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11::jsonb, $12, $13)
      RETURNING *
      `,
      [
        data.patientId,
        data.noteType,
        data.content,
        data.vitalSigns ?? null,
        data.medications ?? null,
        data.observations ?? null,
        JSON.stringify(observationsList),
        data.interventions ?? null,
        JSON.stringify(interventionsList),
        data.outcomes ?? null,
        JSON.stringify(outcomesList),
        data.recordedAt ?? new Date(),
        data.recordedBy,
      ],
    );

    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handleNursingNoteRecorded({
        tenantId,
        tenantDb,
        note: result[0],
        observations: observationsList,
        interventions: interventionsList,
        outcomes: outcomesList,
      });
    } catch (error) {
      this.logger.warn(`CDSS hook failed for nursing note: ${error instanceof Error ? error.message : error}`);
    }

    return {
      ...(result[0] as NursingNote),
      cdssInsights,
    };
  }

  async getByPatient(patientId: string, tenantId: string): Promise<NursingNote[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
  }
}
