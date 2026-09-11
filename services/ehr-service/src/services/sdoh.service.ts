import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { CommunityResource } from '../entities/community-resource.entity';
import { SdohReferral } from '../entities/sdoh-referral.entity';
import { SdohScreeningLog } from '../entities/sdoh-screening-log.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class SdohService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Community Resources ────────────────────────────────────────────────────

  async addResource(ds: DataSource, dto: any) {
    const repo = ds.getRepository(CommunityResource);
    return repo.save(repo.create(dto));
  }

  async getResources(ds: DataSource, category?: string) {
    const qb = ds.getRepository(CommunityResource).createQueryBuilder('r')
      .where('r.is_active = true')
      .orderBy('r.name', 'ASC');
    if (category) qb.andWhere('r.category = :category', { category });
    return qb.getMany();
  }

  async updateResource(ds: DataSource, id: string, dto: any) {
    const repo = ds.getRepository(CommunityResource);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── SDOH Referrals ─────────────────────────────────────────────────────────

  async addReferral(ds: DataSource, dto: any) {
    const repo = ds.getRepository(SdohReferral);
    return repo.save(repo.create(dto));
  }

  async getReferrals(ds: DataSource, patientId: string) {
    return ds.getRepository(SdohReferral).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateReferral(ds: DataSource, id: string, dto: any) {
    const repo = ds.getRepository(SdohReferral);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── SDOH Screening Logs ────────────────────────────────────────────────────

  async addScreeningLog(ds: DataSource, dto: any) {
    const repo = ds.getRepository(SdohScreeningLog);
    return repo.save(repo.create(dto));
  }

  async getScreeningLogs(ds: DataSource, patientId: string) {
    return ds.getRepository(SdohScreeningLog).find({
      where: { patientId },
      order: { screeningDate: 'DESC' },
    });
  }

  // ── CDSS Proxies ───────────────────────────────────────────────────────────

  async screenSdoh(tenantId: string, ds: DataSource, payload: any) {
    return this.cdssService.screenSdohRisk(payload, tenantId, ds);
  }

  async matchResources(tenantId: string, ds: DataSource, payload: any) {
    const resources = await ds.getRepository(CommunityResource).find({
      where: { isActive: true },
      order: { name: 'ASC' },
      take: 200,
    });
    return this.cdssService.matchSdohResources(
      {
        ...payload,
        available_resources: resources.map((resource) => ({
          id: resource.id,
          name: resource.name,
          category: resource.category,
          phone: resource.phone,
          website: resource.website,
          address: resource.address,
          languages: resource.languages || [],
          availability: resource.availability,
        })),
      },
      tenantId,
      ds,
    );
  }
}
