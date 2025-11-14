import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Allergy } from '../entities/allergy.entity';
import { TenantService } from './tenant.service';
import { TerminologyService } from './terminology.service';

@Injectable()
export class AllergyService {
  private readonly logger = new Logger(AllergyService.name);

  constructor(
    private tenantService: TenantService,
    private terminologyService: TerminologyService,
  ) {}

  private async repo(tenantId: string): Promise<Repository<Allergy>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(Allergy);
  }

  async findByPatient(patientId: string, tenantId: string) {
    try {
      const r = await this.repo(tenantId);
      return r.find({ where: { patientId }, order: { recordedAt: 'DESC' } });
    } catch (e) {
      return [];
    }
  }

  async replaceForPatient(patientId: string, items: Partial<Allergy>[], userId: string, tenantId: string) {
    try {
      const db = await this.tenantService.getTenantDatabase(tenantId);
      const repo = db.getRepository(Allergy);

      await repo.delete({ patientId });

      if (!items || items.length === 0) {
        return [];
      }

      const severityConceptMap: Record<string, { code: string; term: string }> = {
        mild: { code: '255604002', term: 'Mild' },
        moderate: { code: '6736007', term: 'Moderate' },
        severe: { code: '24484000', term: 'Severe' },
      };

      const toSave: Allergy[] = [];

      for (const raw of items) {
        if (!raw) {
          continue;
        }

        const allergenConceptId =
          (raw as any).allergenSnomedConceptId ??
          (raw as any).allergenSnomedCode ??
          (raw as any).allergenConceptId ??
          (raw as any).allergenCode ??
          null;

        let allergenConcept: any = null;
        if (allergenConceptId && /^\d+$/.test(String(allergenConceptId))) {
          allergenConcept = await this.terminologyService.validateConcept(db, String(allergenConceptId));
        } else if (allergenConceptId) {
          this.logger.warn(`Received non-numeric allergen concept "${allergenConceptId}" for patient ${patientId}. Storing as free text.`);
        }

        let reactionConcept = null;
        const reactionConceptId =
          (raw as any).reactionSnomedConceptId ??
          (raw as any).reactionSnomedCode ??
          (raw as any).reactionConceptId ??
          null;

        if (reactionConceptId) {
          if (/^\d+$/.test(String(reactionConceptId))) {
            reactionConcept = await this.terminologyService.validateConcept(db, String(reactionConceptId));
          } else {
            this.logger.warn(`Received non-numeric reaction concept "${reactionConceptId}" for patient ${patientId}.`);
          }
        }

        const severityKey = (raw.severity || 'mild').toLowerCase();
        const severity = ['mild', 'moderate', 'severe'].includes(severityKey) ? (severityKey as 'mild' | 'moderate' | 'severe') : 'mild';

        toSave.push(
          repo.create({
            patientId,
            allergen: allergenConcept?.term || allergenConcept?.preferredTerm || (raw as any).allergen || '',
            allergenSnomedCode: allergenConcept?.conceptId ?? null,
            allergenSnomedTerm: allergenConcept?.term || allergenConcept?.preferredTerm || allergenConcept?.fullySpecifiedName || null,
            allergenSnomedModuleId: allergenConcept?.moduleId ?? null,
            reaction: reactionConcept?.term ?? (raw as any).reaction ?? null,
            reactionSnomedCode: reactionConcept?.conceptId ?? null,
            reactionSnomedTerm: reactionConcept?.term ?? reactionConcept?.preferredTerm ?? null,
            severity,
            severitySnomedCode: severityConceptMap[severity]?.code ?? null,
            severitySnomedTerm: severityConceptMap[severity]?.term ?? null,
            recordedBy: userId,
            verificationStatus: 'confirmed',
            clinicalStatus: 'active',
          }),
        );
      }

      if (toSave.length === 0) {
        return [];
      }

      return repo.save(toSave);
    } catch (e) {
      this.logger.error(`Failed to replace allergies for patient ${patientId}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException('Unable to save allergies');
    }
  }
}


