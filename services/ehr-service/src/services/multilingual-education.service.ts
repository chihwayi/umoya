import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { PatientEducationMaterial } from '../entities/patient-education-material.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class MultilingualEducationService {
  private readonly logger = new Logger(MultilingualEducationService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  /**
   * Generate AI patient education material. Called after diagnosis/prescription save.
   */
  async generate(ds: DataSource, tenantId: string, patientId: string, topic: string, language: string, readingLevel = 6, encounterId?: string) {
    let content = '';
    try {
      const data = await this.cdssService.generatePatientEducation(
        {
          topic,
          language,
          reading_level: readingLevel,
          patient_id: patientId,
          encounterId,
        },
        tenantId,
        ds,
      );
      content = data.content || '';
    } catch (e: any) {
      this.logger.warn(`Education generation failed for ${topic}/${language}: ${e?.message}`);
      content = `[Education content for "${topic}" in ${language} — generation pending]`;
    }

    const repo = ds.getRepository(PatientEducationMaterial);
    return repo.save(repo.create({
      patientId, encounterId, topic, language, readingLevel, content,
      contentHtml: `<p>${content.replace(/\n/g, '</p><p>')}</p>`,
      aiGenerated: true,
    }));
  }

  async getMaterials(ds: DataSource, patientId: string) {
    return ds.getRepository(PatientEducationMaterial).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async markDelivered(ds: DataSource, id: string, method: string) {
    const repo = ds.getRepository(PatientEducationMaterial);
    await repo.update(id, { deliveryMethod: method, deliveredAt: new Date() });
    return repo.findOneBy({ id });
  }
}
