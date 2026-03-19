import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { NutritionalScreening } from '../entities/nutritional-screening.entity';
import { NutritionalAssessment } from '../entities/nutritional-assessment.entity';
import { DietaryPrescription } from '../entities/dietary-prescription.entity';
import { NutritionMonitoring } from '../entities/nutrition-monitoring.entity';
import axios from 'axios';

@Injectable()
export class NutritionService {
  constructor(private readonly tenantService: TenantService) {}

  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  // ── Screening ──────────────────────────────────────────────────────────────

  async addScreening(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(NutritionalScreening);
    return repo.save(repo.create({ ...dto, screenedAt: dto.screenedAt || new Date() }));
  }

  async getScreenings(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(NutritionalScreening).find({
      where: { patientId },
      order: { screenedAt: 'DESC' },
      take: 20,
    });
  }

  // ── Assessment ─────────────────────────────────────────────────────────────

  async addAssessment(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(NutritionalAssessment);
    return repo.save(repo.create(dto));
  }

  async getAssessments(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(NutritionalAssessment).find({
      where: { patientId },
      order: { assessmentDate: 'DESC' },
    });
  }

  // ── Dietary Prescription ───────────────────────────────────────────────────

  async addPrescription(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DietaryPrescription);
    return repo.save(repo.create(dto));
  }

  async getPrescriptions(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DietaryPrescription).find({
      where: { patientId },
      order: { prescriptionDate: 'DESC' },
    });
  }

  async updatePrescription(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DietaryPrescription);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── Monitoring ─────────────────────────────────────────────────────────────

  async addMonitoring(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(NutritionMonitoring);
    return repo.save(repo.create(dto));
  }

  async getMonitoring(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(NutritionMonitoring).find({
      where: { patientId },
      order: { monitoringDate: 'DESC' },
      take: 30,
    });
  }

  // ── CDSS ───────────────────────────────────────────────────────────────────

  async screenNutrition(body: any) {
    const res = await axios.post(`${this.cdssUrl}/nutrition/screen`, body);
    return res.data;
  }

  async prescribeNutrition(body: any) {
    const res = await axios.post(`${this.cdssUrl}/nutrition/prescribe`, body);
    return res.data;
  }

  async refeedingRisk(body: any) {
    const res = await axios.post(`${this.cdssUrl}/nutrition/refeeding-risk`, body);
    return res.data;
  }
}
