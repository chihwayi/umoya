import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus, SubscriptionTier } from '../entities/tenant.entity';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { DatabaseProvisioningService } from './database-provisioning.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private databaseProvisioningService: DatabaseProvisioningService,
  ) {}

  async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if subdomain already exists
    const existingTenant = await this.tenantRepository.findOne({
      where: { subdomain: createTenantDto.subdomain }
    });

    if (existingTenant) {
      throw new ConflictException('Subdomain already exists');
    }

    // Generate database name
    const databaseName = `clinic_${createTenantDto.subdomain}_db`;

    // Create tenant record
    const tenant = this.tenantRepository.create({
      ...createTenantDto,
      databaseName,
      status: TenantStatus.PENDING,
      featureFlags: this.getDefaultFeatureFlags(createTenantDto.subscriptionTier),
    });

    const savedTenant = await this.tenantRepository.save(tenant);
    this.logger.log(`Tenant created: ${savedTenant.id}`);

    // Provision database synchronously to ensure it completes
    try {
      await this.provisionTenantDatabase(savedTenant);
    } catch (error) {
      this.logger.error(`Database provisioning failed for tenant ${savedTenant.id}:`, error);
      // Update tenant status to suspended on failure
      savedTenant.status = TenantStatus.SUSPENDED;
      await this.tenantRepository.save(savedTenant);
    }

    return savedTenant;
  }

  async findBySubdomain(subdomain: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { subdomain, status: TenantStatus.ACTIVE }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant> {
    const tenant = await this.findById(id);
    tenant.status = status;
    return this.tenantRepository.save(tenant);
  }

  async deleteTenant(id: string): Promise<void> {
    const tenant = await this.findById(id);
    
    // Delete tenant database
    if (tenant.databaseName) {
      await this.databaseProvisioningService.deleteDatabase(tenant.databaseName);
    }
    
    // Delete tenant record
    await this.tenantRepository.remove(tenant);
    this.logger.log(`Tenant deleted: ${id}`);
  }

  private async provisionTenantDatabase(tenant: Tenant): Promise<void> {
    try {
      this.logger.log(`Starting database provisioning for tenant: ${tenant.id}`);
      
      // Create database and run migrations
      const connectionString = await this.databaseProvisioningService.createDatabase(
        tenant.databaseName
      );

      // Update tenant with connection string and activate
      tenant.connectionString = connectionString;
      tenant.status = TenantStatus.ACTIVE;
      await this.tenantRepository.save(tenant);

      this.logger.log(`Database provisioning completed for tenant: ${tenant.id}`);

    } catch (error) {
      // Mark tenant as suspended on failure
      tenant.status = TenantStatus.SUSPENDED;
      await this.tenantRepository.save(tenant);
      
      this.logger.error(`Database provisioning failed for tenant: ${tenant.id}`, error);
      throw error;
    }
  }

  private getDefaultFeatureFlags(tier: SubscriptionTier): Record<string, boolean> {
    const baseFeatures = {
      patientManagement: true,
      appointments: true,
      medicalRecords: true,
      basicBilling: true,
    };

    switch (tier) {
      case SubscriptionTier.PROFESSIONAL:
        return {
          ...baseFeatures,
          medicalAidClaims: true,
          basicCDSS: true,
          fhirIntegration: true,
          patientPortal: true,
        };
      case SubscriptionTier.ENTERPRISE:
        return {
          ...baseFeatures,
          medicalAidClaims: true,
          advancedCDSS: true,
          fhirIntegration: true,
          hl7Integration: true,
          customReports: true,
          apiAccess: true,
          patientPortal: true,
          telemedicine: true,
          pharmacyManagement: true,
        };
      default:
        return baseFeatures;
    }
  }
}