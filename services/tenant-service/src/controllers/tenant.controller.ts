import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, UseInterceptors, UploadedFile, UseGuards, Query, BadRequestException, NotFoundException, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TenantBillingSummary, TenantService } from '../services/tenant.service';
import { StorageService } from '../services/storage.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantDhis2ConfigPayload, TenantDhis2ConfigView } from '../services/tenant.service';

type SafeTenant = Omit<Tenant, 'connectionString'> & { billingSummary: TenantBillingSummary };
type PublicTenant = Pick<Tenant, 'id' | 'subdomain' | 'clinicName' | 'status' | 'logoUrl' | 'enabledModules' | 'subscriptionMode' | 'packagePreset' | 'subscriptionState' | 'packageName'> & {
  billingSummary: TenantBillingSummary;
};

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
    return {
      ...safeTenant,
      billingSummary: this.tenantService.getBillingSummary(tenant),
    };
  }

  private toPublicTenant(tenant: Tenant): PublicTenant {
    return {
      id: tenant.id,
      subdomain: tenant.subdomain,
      clinicName: tenant.clinicName,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      enabledModules: tenant.enabledModules,
      subscriptionMode: tenant.subscriptionMode,
      packagePreset: tenant.packagePreset,
      subscriptionState: tenant.subscriptionState,
      packageName: tenant.packageName,
      billingSummary: this.tenantService.getBillingSummary(tenant),
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

  @Get('search')
  @ApiOperation({ summary: 'Search active tenants by name or subdomain (public — mobile discovery)' })
  @ApiResponse({ status: 200, description: 'Matching tenants' })
  async searchTenants(
    @Query('q') q: string,
  ): Promise<Array<{ slug: string; name: string; baseUrl: string; logoUrl?: string }>> {
    if (!q || q.trim().length < 2) return [];
    return this.tenantService.searchTenants(q.trim());
  }

  @Get('subdomain/:subdomain')
  async getTenantBySubdomain(@Param('subdomain') subdomain: string): Promise<PublicTenant> {
    const tenant = await this.tenantService.findBySubdomain(subdomain);
    return this.toPublicTenant(tenant);
  }

  @Get(':id/logo')
  @ApiOperation({ summary: 'Stream tenant logo for mobile/web consumers' })
  async getTenantLogo(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const tenant = await this.tenantService.findById(id);
    if (!tenant.logoUrl) {
      throw new NotFoundException('Tenant logo not configured');
    }

    const file = await this.storageService.getObjectByPublicUrl(tenant.logoUrl);
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(file.body);
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

  @Get(':id/subscription-payments/providers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get supported tenant subscription payment providers' })
  async getSubscriptionPaymentProviders(@Param('id') id: string) {
    await this.tenantService.findById(id);
    return this.tenantService.getSubscriptionPaymentProviders();
  }

  @Get(':id/subscription-payments')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get tenant subscription payment history' })
  async getSubscriptionPayments(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    return this.tenantService.listSubscriptionPayments(id, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
  }

  @Post(':id/subscription-payments/session')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create online subscription payment session for tenant' })
  async createSubscriptionPaymentSession(
    @Param('id') id: string,
    @Body()
    body: {
      provider: string;
      amount?: number;
      currency?: string;
      monthsToExtend?: number;
      successUrl?: string;
      cancelUrl?: string;
      metadata?: Record<string, any>;
    },
  ) {
    if (!body || !String(body.provider || '').trim()) {
      throw new BadRequestException('provider is required');
    }
    return this.tenantService.createSubscriptionPaymentSession(id, body);
  }

  @Post(':id/subscription-payments/:paymentId/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Confirm/update tenant subscription payment status' })
  async confirmSubscriptionPayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body()
    body: {
      status: 'successful' | 'failed' | 'cancelled';
      externalPaymentId?: string;
      note?: string;
    },
  ) {
    return this.tenantService.confirmSubscriptionPayment(id, paymentId, body || { status: 'failed' });
  }
}
