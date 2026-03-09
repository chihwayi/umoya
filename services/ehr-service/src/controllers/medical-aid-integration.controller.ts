import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TenantService } from '../services/tenant.service';
import { MedicalAidIntegrationService } from '../services/medical-aid-integration.service';

@ApiTags('Medical Aid Integration')
@ApiBearerAuth()
@Controller('medical-aid')
@UseGuards(JwtAuthGuard)
export class MedicalAidIntegrationController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly medicalAidIntegrationService: MedicalAidIntegrationService,
  ) {}

  @Get('providers')
  @ApiOperation({ summary: 'List medical aid providers' })
  async listProviders(@Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.medicalAidIntegrationService.listProviders(tenantDb);
  }

  @Post('providers')
  @ApiOperation({ summary: 'Upsert medical aid provider config (stub)' })
  async upsertProvider(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.medicalAidIntegrationService.upsertProvider(tenantDb, body);
  }

  @Get('eligibility')
  @ApiOperation({ summary: 'List eligibility checks (optionally by patient)' })
  async listEligibility(@Query('patientId') patientId: string | undefined, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.medicalAidIntegrationService.listEligibilityChecks(tenantDb, patientId);
  }

  @Post('eligibility')
  @ApiOperation({ summary: 'Create eligibility check (stub)' })
  async createEligibility(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return await this.medicalAidIntegrationService.createEligibilityCheck(tenantDb, userId, body);
  }

  @Get('claims')
  @ApiOperation({ summary: 'List medical aid claim submissions (optionally by provider)' })
  async listClaims(@Query('providerId') providerId: string | undefined, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.medicalAidIntegrationService.listClaimSubmissions(tenantDb, providerId);
  }

  @Post('claims')
  @ApiOperation({ summary: 'Create claim submission (stub)' })
  async createClaim(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return await this.medicalAidIntegrationService.createClaimSubmission(tenantDb, userId, body);
  }

  @Post('claims/:id/submit')
  @ApiOperation({ summary: 'Submit claim (stub)' })
  async submitClaim(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.medicalAidIntegrationService.submitClaim(tenantDb, id);
  }

  @Get('remittances')
  @ApiOperation({ summary: 'List remittances (optionally by provider)' })
  async listRemittances(@Query('providerId') providerId: string | undefined, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.medicalAidIntegrationService.listRemittances(tenantDb, providerId);
  }

  @Post('remittances')
  @ApiOperation({ summary: 'Create remittance record (stub)' })
  async createRemittance(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return await this.medicalAidIntegrationService.createRemittance(tenantDb, userId, body);
  }

  @Post('remittances/:id/process')
  @ApiOperation({ summary: 'Process remittance (stub)' })
  async processRemittance(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return await this.medicalAidIntegrationService.processRemittance(tenantDb, id, userId);
  }
}

