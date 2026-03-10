import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantService } from '../services/tenant.service';
import { StorageService } from '../services/storage.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantDhis2ConfigPayload, TenantDhis2ConfigView } from '../services/tenant.service';

type SafeTenant = Omit<Tenant, 'connectionString'>;
type PublicTenant = Pick<Tenant, 'id' | 'subdomain' | 'clinicName' | 'status' | 'logoUrl'>;

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly storageService: StorageService
  ) {}

  private toSafeTenant(tenant: Tenant): SafeTenant {
    // Never expose direct tenant DB credentials through API responses.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { connectionString, ...safeTenant } = tenant;
    return safeTenant;
  }

  private toPublicTenant(tenant: Tenant): PublicTenant {
    return {
      id: tenant.id,
      subdomain: tenant.subdomain,
      clinicName: tenant.clinicName,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
    };
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload tenant logo' })
  @ApiResponse({ status: 201, description: 'Logo uploaded successfully' })
  async uploadLogo(@UploadedFile() file: any): Promise<{ url: string }> {
    const url = await this.storageService.uploadLogo(file);
    return { url };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async createTenant(
    @Body(ValidationPipe) createTenantDto: CreateTenantDto
  ): Promise<{ tenant: SafeTenant; message: string }> {
    const tenant = await this.tenantService.createTenant(createTenantDto);
    return {
      tenant: this.toSafeTenant(tenant),
      message: 'Tenant created successfully. Database provisioning in progress.'
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'List of all tenants' })
  async getAllTenants(): Promise<SafeTenant[]> {
    const tenants = await this.tenantService.getAllTenants();
    return tenants.map((tenant) => this.toSafeTenant(tenant));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active tenants (public-safe payload)' })
  @ApiResponse({ status: 200, description: 'List of active tenants' })
  async getActiveTenants(): Promise<PublicTenant[]> {
    const tenants = await this.tenantService.getAllTenants();
    return tenants
      .filter((tenant) => tenant.status === TenantStatus.ACTIVE)
      .map((tenant) => this.toPublicTenant(tenant));
  }

  @Get('subdomain/:subdomain')
  async getTenantBySubdomain(@Param('subdomain') subdomain: string): Promise<PublicTenant> {
    const tenant = await this.tenantService.findBySubdomain(subdomain);
    return this.toPublicTenant(tenant);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTenantById(@Param('id') id: string): Promise<SafeTenant> {
    const tenant = await this.tenantService.findById(id);
    return this.toSafeTenant(tenant);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update tenant details' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  async updateTenant(
    @Param('id') id: string,
    @Body(ValidationPipe) updateTenantDto: UpdateTenantDto
  ): Promise<SafeTenant> {
    const tenant = await this.tenantService.updateTenant(id, updateTenantDto);
    return this.toSafeTenant(tenant);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateTenantStatus(
    @Param('id') id: string,
    @Body('status') status: TenantStatus
  ): Promise<SafeTenant> {
    const tenant = await this.tenantService.updateTenantStatus(id, status);
    return this.toSafeTenant(tenant);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteTenant(@Param('id') id: string): Promise<{ message: string }> {
    await this.tenantService.deleteTenant(id);
    return { message: 'Tenant deleted successfully' };
  }

  @Get(':id/health')
  @UseGuards(JwtAuthGuard)
  async checkTenantHealth(@Param('id') id: string): Promise<{ status: string; database: string }> {
    const tenant = await this.tenantService.findById(id);
    return {
      status: tenant.status,
      database: tenant.connectionString ? 'connected' : 'not_connected'
    };
  }

  @Get(':id/dhis2-config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get tenant DHIS2 integration config (secret-safe view)' })
  async getTenantDhis2Config(@Param('id') id: string): Promise<TenantDhis2ConfigView | { configured: false }> {
    const config = await this.tenantService.getTenantDhis2Config(id);
    if (!config) {
      return { configured: false };
    }
    return config;
  }

  @Put(':id/dhis2-config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create/update tenant DHIS2 integration config' })
  async upsertTenantDhis2Config(
    @Param('id') id: string,
    @Body(ValidationPipe) body: TenantDhis2ConfigPayload,
  ): Promise<TenantDhis2ConfigView> {
    return this.tenantService.upsertTenantDhis2Config(id, body);
  }

  @Delete(':id/dhis2-config')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete tenant DHIS2 integration config' })
  async clearTenantDhis2Config(@Param('id') id: string): Promise<{ message: string }> {
    await this.tenantService.clearTenantDhis2Config(id);
    return { message: 'Tenant DHIS2 config deleted' };
  }
}
