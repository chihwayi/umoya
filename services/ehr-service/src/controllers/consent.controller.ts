import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ConsentTemplateService } from '../services/consent-template.service';
import { PatientConsentService } from '../services/patient-consent.service';
import { TenantService } from '../services/tenant.service';
import {
  CreateConsentTemplateDto,
  UpdateConsentTemplateDto,
  CreatePatientConsentDto,
  SignConsentDto,
  DeclineConsentDto,
  RevokeConsentDto,
  ConsentQueryDto,
} from '../dto/consent.dto';

@ApiTags('Consents')
@ApiBearerAuth()
@Controller('consents')
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(
    private readonly consentTemplateService: ConsentTemplateService,
    private readonly patientConsentService: PatientConsentService,
    private readonly tenantService: TenantService,
  ) {}

  // ==================== CONSENT TEMPLATES ====================

  @Post('templates')
  @ApiOperation({ summary: 'Create consent template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(@Body() templateData: CreateConsentTemplateDto, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.createTemplate(templateData, req.user.userId, tenantDb);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get consent templates' })
  async getTemplates(@Query() filters: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.getTemplates(filters, tenantDb);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by ID' })
  async getTemplateById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.getTemplateById(id, tenantDb);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update consent template' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() updates: UpdateConsentTemplateDto,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.updateTemplate(id, updates, tenantDb);
  }

  @Post('templates/:id/activate')
  @ApiOperation({ summary: 'Activate template' })
  @HttpCode(HttpStatus.OK)
  async activateTemplate(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.activateTemplate(id, tenantDb);
  }

  @Post('templates/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate template' })
  @HttpCode(HttpStatus.OK)
  async deactivateTemplate(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.deactivateTemplate(id, tenantDb);
  }

  @Get('templates/code/:code/versions')
  @ApiOperation({ summary: 'Get template version history' })
  async getTemplateVersions(@Param('code') code: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.getTemplateVersions(code, tenantDb);
  }

  @Post('templates/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate template' })
  async duplicateTemplate(
    @Param('id') id: string,
    @Body('newVersion') newVersion: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.duplicateTemplate(id, newVersion, req.user.userId, tenantDb);
  }

  @Post('templates/:id/preview')
  @ApiOperation({ summary: 'Preview template with sample data' })
  @HttpCode(HttpStatus.OK)
  async previewTemplate(
    @Param('id') id: string,
    @Body('sampleData') sampleData: Record<string, any>,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.consentTemplateService.previewTemplate(id, sampleData, tenantDb);
  }

  // ==================== PATIENT CONSENTS ====================

  @Post()
  @ApiOperation({ summary: 'Create patient consent from template' })
  @ApiResponse({ status: 201, description: 'Consent created successfully' })
  async createConsent(@Body() consentData: CreatePatientConsentDto, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.createConsent(
      consentData,
      req.user.userId,
      req.ip,
      req.headers['user-agent'],
      tenantDb,
    );
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get patient consents' })
  async getPatientConsents(
    @Param('patientId') patientId: string,
    @Query() filters: ConsentQueryDto,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.getPatientConsents(patientId, filters, tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consent by ID' })
  async getConsentById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.getConsentById(id, tenantDb);
  }

  @Post(':id/present')
  @ApiOperation({ summary: 'Mark consent as presented to patient' })
  @HttpCode(HttpStatus.OK)
  async presentConsent(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.presentConsent(
      id,
      req.user.userId,
      req.ip,
      req.headers['user-agent'],
      tenantDb,
    );
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign consent' })
  @HttpCode(HttpStatus.OK)
  async signConsent(
    @Param('id') id: string,
    @Body() signatureData: SignConsentDto,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.signConsent(
      id,
      signatureData,
      req.user.userId,
      req.ip,
      req.headers['user-agent'],
      tenantDb,
    );
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline consent' })
  @HttpCode(HttpStatus.OK)
  async declineConsent(
    @Param('id') id: string,
    @Body() declineData: DeclineConsentDto,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.declineConsent(
      id,
      declineData,
      req.user.userId,
      req.ip,
      req.headers['user-agent'],
      tenantDb,
    );
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke consent' })
  @HttpCode(HttpStatus.OK)
  async revokeConsent(
    @Param('id') id: string,
    @Body() revokeData: RevokeConsentDto,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.revokeConsent(
      id,
      revokeData,
      req.user.userId,
      req.ip,
      req.headers['user-agent'],
      tenantDb,
    );
  }

  @Get(':id/validity')
  @ApiOperation({ summary: 'Check consent validity' })
  async checkValidity(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.checkConsentValidity(id, tenantDb);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export consent' })
  async exportConsent(
    @Param('id') id: string,
    @Query('format') format: 'pdf' | 'json' = 'json',
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.exportConsent(
      id,
      format,
      req.user.userId,
      req.ip,
      req.headers['user-agent'],
      tenantDb,
    );
  }

  @Get('patient/:patientId/history')
  @ApiOperation({ summary: 'Get patient consent history with audit trail' })
  async getConsentHistory(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.getConsentHistory(patientId, tenantDb);
  }

  @Get('patient/:patientId/active/:consentType')
  @ApiOperation({ summary: 'Get active consents for patient by type' })
  async getActiveConsents(
    @Param('patientId') patientId: string,
    @Param('consentType') consentType: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.patientConsentService.getActiveConsents(patientId, consentType, tenantDb);
  }
}

