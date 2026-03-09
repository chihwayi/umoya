import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { AnesthesiaService } from '../services/anesthesia.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Anesthesia')
@ApiBearerAuth()
@Controller('anesthesia')
@UseGuards(JwtAuthGuard)
export class AnesthesiaController {
  constructor(
    private readonly anesthesiaService: AnesthesiaService,
    private readonly tenantService: TenantService,
  ) {}

  // ==================== PRE-ANESTHESIA ASSESSMENT ====================

  @Post('pre-assessment')
  @ApiOperation({ summary: 'Create pre-anesthesia assessment' })
  @ApiResponse({ status: 201, description: 'Assessment created' })
  async createPreAnesthesiaAssessment(
    @Body() assessmentData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.createPreAnesthesiaAssessment(
      assessmentData,
      ((req.user as any)?.userId ?? (req.user as any)?.id),
      tenantDb,
    );
  }

  @Get('pre-assessment/case/:caseId')
  @ApiOperation({ summary: 'Get pre-anesthesia assessment by case ID' })
  @ApiResponse({ status: 200, description: 'Assessment retrieved' })
  async getPreAnesthesiaAssessment(
    @Param('caseId') caseId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.getPreAnesthesiaAssessment(caseId, tenantDb);
  }

  @Put('pre-assessment/:id')
  @ApiOperation({ summary: 'Update pre-anesthesia assessment' })
  @ApiResponse({ status: 200, description: 'Assessment updated' })
  async updatePreAnesthesiaAssessment(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.updatePreAnesthesiaAssessment(id, updateData, tenantDb);
  }

  // ==================== ANESTHESIA RECORD ====================

  @Post('record/start')
  @ApiOperation({ summary: 'Start anesthesia record' })
  @ApiResponse({ status: 201, description: 'Record started' })
  async startAnesthesiaRecord(
    @Body() recordData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.startAnesthesiaRecord(recordData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Get('record/case/:caseId')
  @ApiOperation({ summary: 'Get anesthesia record by case ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved' })
  async getAnesthesiaRecord(
    @Param('caseId') caseId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.getAnesthesiaRecord(caseId, tenantDb);
  }

  @Put('record/:id')
  @ApiOperation({ summary: 'Update anesthesia record' })
  @ApiResponse({ status: 200, description: 'Record updated' })
  async updateAnesthesiaRecord(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.updateAnesthesiaRecord(id, updateData, tenantDb);
  }

  @Post('record/:id/complete')
  @ApiOperation({ summary: 'Complete anesthesia record' })
  @ApiResponse({ status: 200, description: 'Record completed' })
  async completeAnesthesiaRecord(
    @Param('id') id: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.completeAnesthesiaRecord(id, tenantDb);
  }

  // ==================== VITALS ====================

  @Post('record/:id/vitals')
  @ApiOperation({ summary: 'Record anesthesia vitals' })
  @ApiResponse({ status: 201, description: 'Vitals recorded' })
  async recordVitals(
    @Param('id') id: string,
    @Body() vitalsData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.recordVitals(id, vitalsData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Get('record/:id/vitals')
  @ApiOperation({ summary: 'Get anesthesia vitals timeline' })
  @ApiResponse({ status: 200, description: 'Vitals retrieved' })
  async getVitalsByRecord(
    @Param('id') id: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.getVitalsByRecord(id, tenantDb);
  }

  // ==================== MEDICATIONS & EVENTS ====================

  @Post('record/:id/medication')
  @ApiOperation({ summary: 'Record medication administered' })
  @ApiResponse({ status: 200, description: 'Medication recorded' })
  async recordMedication(
    @Param('id') id: string,
    @Body() medicationData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.recordMedication(id, medicationData, tenantDb);
  }

  @Post('record/:id/event')
  @ApiOperation({ summary: 'Record intraoperative event' })
  @ApiResponse({ status: 200, description: 'Event recorded' })
  async recordEvent(
    @Param('id') id: string,
    @Body() eventData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.recordEvent(id, eventData, tenantDb);
  }

  // ==================== PACU ====================

  @Get('pacu/active')
  @ApiOperation({ summary: 'Get active PACU patients' })
  @ApiResponse({ status: 200, description: 'Active PACU patients retrieved' })
  async getActivePACUPatients(
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.getActivePACUPatients(tenantDb);
  }

  @Post('pacu/admit')
  @ApiOperation({ summary: 'Admit patient to PACU' })
  @ApiResponse({ status: 201, description: 'Patient admitted to PACU' })
  async admitToPACU(
    @Body() pacuData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.admitToPACU(pacuData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Get('pacu/:id')
  @ApiOperation({ summary: 'Get PACU record' })
  @ApiResponse({ status: 200, description: 'PACU record retrieved' })
  async getPACURecord(
    @Param('id') id: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.getPACURecord(id, tenantDb);
  }

  @Put('pacu/:id/aldrete')
  @ApiOperation({ summary: 'Update Aldrete score' })
  @ApiResponse({ status: 200, description: 'Aldrete score updated' })
  async updateAldreteScore(
    @Param('id') id: string,
    @Body() scoreData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.updateAldreteScore(id, scoreData, tenantDb);
  }

  @Post('pacu/:id/discharge')
  @ApiOperation({ summary: 'Discharge patient from PACU' })
  @ApiResponse({ status: 200, description: 'Patient discharged from PACU' })
  async dischargePACU(
    @Param('id') id: string,
    @Body() dischargeData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.dischargePACU(id, dischargeData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  // ==================== BILLING ====================

  @Post('billing/calculate')
  @ApiOperation({ summary: 'Calculate anesthesia billing' })
  @ApiResponse({ status: 201, description: 'Billing calculated' })
  async calculateAnesthesiaBilling(
    @Body() billingData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.calculateAnesthesiaBilling(
      billingData.caseId,
      billingData,
      tenantDb,
    );
  }

  @Get('billing/case/:caseId')
  @ApiOperation({ summary: 'Get anesthesia billing for case' })
  @ApiResponse({ status: 200, description: 'Billing retrieved' })
  async getAnesthesiaBilling(
    @Param('caseId') caseId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.getAnesthesiaBilling(caseId, tenantDb);
  }

  @Post('billing/:id/mark-billed')
  @ApiOperation({ summary: 'Mark anesthesia billing as billed' })
  @ApiResponse({ status: 200, description: 'Billing marked as billed' })
  async markBilled(
    @Param('id') id: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.anesthesiaService.markBilled(id, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }
}

