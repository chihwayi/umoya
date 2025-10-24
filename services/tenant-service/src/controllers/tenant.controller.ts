import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant, TenantStatus } from '../entities/tenant.entity';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Create new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async createTenant(
    @Body(ValidationPipe) createTenantDto: CreateTenantDto
  ): Promise<{ tenant: Tenant; message: string }> {
    const tenant = await this.tenantService.createTenant(createTenantDto);
    return {
      tenant,
      message: 'Tenant created successfully. Database provisioning in progress.'
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'List of all tenants' })
  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantService.getAllTenants();
  }

  @Get(':id')
  async getTenantById(@Param('id') id: string): Promise<Tenant> {
    return this.tenantService.findById(id);
  }

  @Get('subdomain/:subdomain')
  async getTenantBySubdomain(@Param('subdomain') subdomain: string): Promise<Tenant> {
    return this.tenantService.findBySubdomain(subdomain);
  }

  @Put(':id/status')
  async updateTenantStatus(
    @Param('id') id: string,
    @Body('status') status: TenantStatus
  ): Promise<Tenant> {
    return this.tenantService.updateTenantStatus(id, status);
  }

  @Delete(':id')
  async deleteTenant(@Param('id') id: string): Promise<{ message: string }> {
    await this.tenantService.deleteTenant(id);
    return { message: 'Tenant deleted successfully' };
  }

  @Get(':id/health')
  async checkTenantHealth(@Param('id') id: string): Promise<{ status: string; database: string }> {
    const tenant = await this.tenantService.findById(id);
    return {
      status: tenant.status,
      database: tenant.connectionString ? 'connected' : 'not_connected'
    };
  }
}