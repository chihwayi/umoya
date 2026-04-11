import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { FamilyPlanningEnrollment } from '../entities/family-planning-enrollment.entity';
import { FamilyPlanningFollowup } from '../entities/family-planning-followup.entity';

@Injectable()
export class FamilyPlanningService {
  constructor(private readonly tenantService: TenantService) {}

  async enroll(
    tenantId: string,
    enrolledBy: string | null,
    dto: Partial<FamilyPlanningEnrollment>,
  ): Promise<FamilyPlanningEnrollment> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FamilyPlanningEnrollment);

    if (dto.patientId) {
      await repo.update(
        { patientId: dto.patientId, status: 'active' },
        {
          status: 'discontinued',
          discontinuationReason: 'Superseded by new family planning enrollment',
        } as Partial<FamilyPlanningEnrollment>,
      );
    }

    const entity = repo.create({
      ...dto,
      enrolledBy: enrolledBy ?? dto.enrolledBy,
    } as Partial<FamilyPlanningEnrollment>);
    return repo.save(entity) as unknown as FamilyPlanningEnrollment;
  }

  async getEnrollments(tenantId: string, patientId: string): Promise<FamilyPlanningEnrollment[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FamilyPlanningEnrollment).find({
      where: { patientId },
      order: { enrolledAt: 'DESC' },
    });
  }

  async getActiveEnrollment(tenantId: string, patientId: string): Promise<FamilyPlanningEnrollment | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FamilyPlanningEnrollment).findOne({
      where: { patientId, status: 'active' },
      order: { enrolledAt: 'DESC' },
    });
  }

  async updateEnrollment(
    tenantId: string,
    id: string,
    dto: Partial<FamilyPlanningEnrollment>,
  ): Promise<FamilyPlanningEnrollment | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FamilyPlanningEnrollment);
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Family planning enrollment not found');
    }
    await repo.update(id, dto);
    return repo.findOne({ where: { id } });
  }

  async recordFollowup(
    tenantId: string,
    conductedBy: string | null,
    dto: Partial<FamilyPlanningFollowup>,
  ): Promise<FamilyPlanningFollowup> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(FamilyPlanningFollowup);
    const entity = repo.create({
      ...dto,
      conductedBy: conductedBy ?? dto.conductedBy,
    } as Partial<FamilyPlanningFollowup>);
    return repo.save(entity) as unknown as FamilyPlanningFollowup;
  }

  async getFollowups(tenantId: string, patientId: string): Promise<FamilyPlanningFollowup[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(FamilyPlanningFollowup).find({
      where: { patientId },
      order: { visitDate: 'DESC', createdAt: 'DESC' },
    });
  }
}
