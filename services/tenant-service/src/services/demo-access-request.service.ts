import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { DemoAccessRequest, DemoAccessRequestStatus } from '../entities/demo-access-request.entity';
import { CreateDemoAccessRequestDto } from '../dto/create-demo-access-request.dto';
import { UpdateDemoAccessRequestDto } from '../dto/update-demo-access-request.dto';
import { Tenant, SubscriptionTier } from '../entities/tenant.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class DemoAccessRequestService implements OnModuleInit {
  constructor(
    @InjectRepository(DemoAccessRequest)
    private readonly demoAccessRequestRepository: Repository<DemoAccessRequest>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly tenantService: TenantService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS demo_access_requests (
        id varchar(36) PRIMARY KEY,
        full_name varchar(160) NOT NULL,
        clinic_name varchar(160) NOT NULL,
        work_email varchar(160) NOT NULL,
        phone varchar(50) NOT NULL,
        role_title varchar(120),
        specialization varchar(120),
        current_system varchar(160),
        interest_summary text NOT NULL,
        interest_areas text NOT NULL DEFAULT '[]',
        preferred_contact_method varchar(32) NOT NULL DEFAULT 'email',
        status varchar(32) NOT NULL DEFAULT 'new',
        admin_notes text,
        assigned_tenant_id varchar(36),
        assigned_subdomain varchar(120),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_demo_access_requests_status_created
      ON demo_access_requests(status, created_at DESC)
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_demo_access_requests_work_email
      ON demo_access_requests(work_email)
    `);
  }

  async createRequest(body: CreateDemoAccessRequestDto): Promise<DemoAccessRequest> {
    const entity = this.demoAccessRequestRepository.create({
      id: randomUUID(),
      fullName: body.fullName.trim(),
      clinicName: body.clinicName.trim(),
      workEmail: body.workEmail.trim().toLowerCase(),
      phone: body.phone.trim(),
      roleTitle: body.roleTitle?.trim() || null,
      specialization: body.specialization?.trim() || null,
      currentSystem: body.currentSystem?.trim() || null,
      interestSummary: body.interestSummary.trim(),
      interestAreas: body.interestAreas.map((item) => item.trim()).filter(Boolean),
      preferredContactMethod: body.preferredContactMethod || 'email',
      status: 'new',
      adminNotes: null,
      assignedTenantId: null,
      assignedSubdomain: null,
    });

    return this.demoAccessRequestRepository.save(entity);
  }

  async listRequests(status?: DemoAccessRequestStatus): Promise<DemoAccessRequest[]> {
    const where = status ? { status } : {};
    return this.demoAccessRequestRepository.find({
      where,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async updateRequest(id: string, body: UpdateDemoAccessRequestDto): Promise<DemoAccessRequest> {
    const existing = await this.demoAccessRequestRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Demo access request not found');
    }

    existing.status = body.status;
    existing.adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes.trim() || null : existing.adminNotes;
    existing.assignedTenantId = typeof body.assignedTenantId === 'string' ? body.assignedTenantId.trim() || null : existing.assignedTenantId;
    existing.assignedSubdomain = typeof body.assignedSubdomain === 'string' ? body.assignedSubdomain.trim() || null : existing.assignedSubdomain;

    return this.demoAccessRequestRepository.save(existing);
  }

  async provisionTestingTenant(id: string): Promise<{ request: DemoAccessRequest; tenant: Tenant }> {
    const request = await this.demoAccessRequestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Demo access request not found');
    }

    if (request.assignedTenantId && request.assignedSubdomain) {
      const existingTenant = await this.tenantService.findById(request.assignedTenantId);
      return { request, tenant: existingTenant };
    }

    const subdomain = await this.generateUniqueTrialSubdomain(request.clinicName);
    const tenant = await this.tenantService.createTenant({
      clinicName: `${request.clinicName} Trial`,
      subdomain,
      contactEmail: request.workEmail,
      contactPhone: request.phone,
      address: undefined,
      city: undefined,
      logoUrl: undefined,
      subscriptionTier: SubscriptionTier.ENTERPRISE,
      subscriptionMode: 'demo',
      packagePreset: 'full_ehr',
      packageName: 'Guided Demo',
      demoDurationDays: 14,
      enabledModules: ['hiv', 'patient_portal', 'claims', 'telemedicine'],
      suspensionWarningDays: 5,
    });

    request.status = 'provisioned';
    request.assignedTenantId = tenant.id;
    request.assignedSubdomain = tenant.subdomain;
    request.adminNotes = this.appendProvisionNote(request.adminNotes, tenant.subdomain);

    const savedRequest = await this.demoAccessRequestRepository.save(request);
    return { request: savedRequest, tenant };
  }

  private appendProvisionNote(current: string | null, subdomain: string): string {
    const note = `Testing tenant provisioned: ${subdomain}`;
    if (!current || !current.trim()) {
      return note;
    }
    if (current.includes(note)) {
      return current;
    }
    return `${current.trim()}\n${note}`;
  }

  private async generateUniqueTrialSubdomain(clinicName: string): Promise<string> {
    const base = (clinicName || 'medicore-demo')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'medicore-demo';

    const root = `${base.replace(/-trial$/, '')}-trial`.slice(0, 48).replace(/^-+|-+$/g, '');

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
      const candidate = `${root}${suffix}`.slice(0, 50).replace(/-+$/g, '');
      const existing = await this.tenantRepository.findOne({ where: { subdomain: candidate } });
      if (!existing) {
        return candidate;
      }
    }

    return `medicore-trial-${randomUUID().slice(0, 8)}`;
  }
}
