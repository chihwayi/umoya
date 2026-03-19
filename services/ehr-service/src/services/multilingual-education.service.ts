import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PatientEducationMaterial } from '../entities/patient-education-material.entity';
import axios from 'axios';

@Injectable()
export class MultilingualEducationService {
  private readonly logger = new Logger(MultilingualEducationService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  constructor(private readonly tenantService: TenantService) {}

  /**
   * Generate AI patient education material. Called after diagnosis/prescription save.
   */
  async generate(subdomain: string, patientId: string, topic: string, language: string, readingLevel = 6, encounterId?: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    let content = '';
    try {
      const { data } = await axios.post(`${this.cdssUrl}/education/generate`, {
        topic, language, reading_level: readingLevel, patient_id: patientId,
      });
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

  async getMaterials(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(PatientEducationMaterial).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async markDelivered(subdomain: string, id: string, method: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(PatientEducationMaterial);
    await repo.update(id, { deliveryMethod: method, deliveredAt: new Date() });
    return repo.findOneBy({ id });
  }
}
