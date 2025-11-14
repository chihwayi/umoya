import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Problem } from '../entities/problem.entity';
import { TenantService } from './tenant.service';
import { TerminologyService } from './terminology.service';

@Injectable()
export class ProblemService {
  private readonly logger = new Logger(ProblemService.name);

  constructor(
    private tenantService: TenantService,
    private terminologyService: TerminologyService,
  ) {}

  private async repo(tenantId: string): Promise<Repository<Problem>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(Problem);
  }

  async findByPatient(patientId: string, tenantId: string) {
    try {
      const r = await this.repo(tenantId);
      return r.find({ where: { patientId }, order: { updatedAt: 'DESC' } });
    } catch (e) {
      // If table missing or any error, return empty list to avoid 500s
      return [];
    }
  }

  async replaceForPatient(patientId: string, items: Partial<Problem>[], tenantId: string) {
    try {
      const db = await this.tenantService.getTenantDatabase(tenantId);
      const repo = db.getRepository(Problem);

      await repo.delete({ patientId });

      if (!items || items.length === 0) {
        return [];
      }

      const toSave: Problem[] = [];
      for (const raw of items) {
        if (!raw) {
          continue;
        }

        const conceptId =
          (raw as any).snomedConceptId ??
          (raw as any).conceptId ??
          raw.code ??
          (raw as any).snomed?.conceptId ??
          null;

        let concept: any = null;
        if (conceptId && /^\d+$/.test(String(conceptId))) {
          concept = await this.terminologyService.validateConcept(db, String(conceptId));
        } else if (conceptId) {
          this.logger.warn(`Received non-numeric SNOMED conceptId "${conceptId}" for patient ${patientId} - storing as free text.`);
        }

        const description =
          (raw as any).description ??
          (raw as any).term ??
          concept?.preferredTerm ??
          concept?.term ??
          concept?.fullySpecifiedName ??
          '';

        if (!description) {
          throw new BadRequestException('Problem description or SNOMED term is required');
        }

        toSave.push(
          repo.create({
            patientId,
            code: concept?.conceptId ?? (raw as any).code ?? null,
            codeSystem: 'SNOMED_CT',
            snomedConceptId: concept?.conceptId ?? null,
            snomedTerm: (raw as any).term ?? concept?.term ?? concept?.preferredTerm ?? description,
            snomedModuleId: concept?.moduleId ?? null,
            snomedDefinitionStatus: concept?.definitionStatus ?? null,
            description: description.toString(),
            status: ((raw as any).status as any) || 'active',
            onsetDate: raw.onsetDate ? new Date(raw.onsetDate as any) : null,
            resolvedDate: raw.resolvedDate ? new Date(raw.resolvedDate as any) : null,
            notes: (raw as any).notes ?? null,
          }),
        );
      }

      if (toSave.length === 0) {
        return [];
      }

      return repo.save(toSave);
    } catch (e) {
      this.logger.error(`Failed to replace problem list for patient ${patientId}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException('Unable to save problem list');
    }
  }
}


