import { Controller, Get, Post, Put, Delete, Body, Param, ValidationPipe, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantService } from '../services/tenant.service';
import { StorageService } from '../services/storage.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant, TenantStatus } from '../entities/tenant.entity';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly storageService: StorageService
  ) {}

  @Post('logo')
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
  async uploadLogo(@UploadedFile() file: Express.Multer.File): Promise<{ url: string }> {
    const url = await this.storageService.uploadLogo(file);
    return { url };
  }

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