import { Injectable } from '@nestjs/common';
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

  async addResource(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CommunityResource);
    return repo.save(repo.create(dto));
  }

  async getResources(subdomain: string, category?: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const qb = ds.getRepository(CommunityResource).createQueryBuilder('r')
      .where('r.is_active = true')
      .orderBy('r.name', 'ASC');
    if (category) qb.andWhere('r.category = :category', { category });
    return qb.getMany();
  }

  async updateResource(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(CommunityResource);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── SDOH Referrals ─────────────────────────────────────────────────────────

  async addReferral(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SdohReferral);
    return repo.save(repo.create(dto));
  }

  async getReferrals(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SdohReferral).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateReferral(subdomain: string, id: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SdohReferral);
    await repo.update(id, dto);
    return repo.findOneBy({ id });
  }

  // ── SDOH Screening Logs ────────────────────────────────────────────────────

  async addScreeningLog(subdomain: string, dto: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(SdohScreeningLog);
    return repo.save(repo.create(dto));
  }

  async getScreeningLogs(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(SdohScreeningLog).find({
      where: { patientId },
      order: { screeningDate: 'DESC' },
    });
  }

  // ── CDSS Proxies ───────────────────────────────────────────────────────────

  async screenSdoh(subdomain: string, payload: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return this.cdssService.screenSdohRisk(payload, subdomain, ds);
  }

  async matchResources(subdomain: string, payload: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
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
      subdomain,
      ds,
    );
  }
}
