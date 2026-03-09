import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { BcmaService } from '../services/bcma.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('BCMA - Medication Safety')
@ApiBearerAuth()
@Controller('bcma')
@UseGuards(JwtAuthGuard)
export class BcmaController {
  constructor(
    private readonly bcmaService: BcmaService,
    private readonly tenantService: TenantService,
  ) {}

  // ==================== PATIENT WRISTBAND ====================

  @Post('wristband/issue')
  @ApiOperation({ summary: 'Issue patient wristband with barcode' })
  @ApiResponse({ status: 201, description: 'Wristband issued' })
  async issueWristband(
    @Body() data: { patientId: string; admissionId?: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bcmaService.issueWristband(
      data.patientId,
      data.admissionId || null,
      userId,
      tenantDb,
    );
  }

  @Get('wristband/verify/:barcode')
  @ApiOperation({ summary: 'Verify patient wristband barcode' })
  @ApiResponse({ status: 200, description: 'Wristband verified' })
  async verifyWristband(
    @Param('barcode') barcode: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bcmaService.verifyWristband(barcode, tenantDb);
  }

  // ==================== MEDICATION BARCODE ====================

  @Get('medication/verify/:barcode')
  @ApiOperation({ summary: 'Verify medication barcode' })
  @ApiResponse({ status: 200, description: 'Medication verified' })
  async verifyMedicationBarcode(
    @Param('barcode') barcode: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bcmaService.verifyMedicationBarcode(barcode, tenantDb);
  }

  // ==================== 5 RIGHTS VERIFICATION ====================

  @Post('verify-5-rights')
  @ApiOperation({ summary: 'Verify 5 Rights before medication administration' })
  @ApiResponse({ status: 200, description: '5 Rights verification result' })
  async verify5Rights(
    @Body() data: { patientBarcode: string; medicationBarcode: string; prescriptionId: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bcmaService.verify5Rights(
      data.patientBarcode,
      data.medicationBarcode,
      data.prescriptionId,
      tenantDb,
    );
  }

  // ==================== MEDICATION ADMINISTRATION ====================

  @Post('administer')
  @ApiOperation({ summary: 'Administer medication and create MAR' })
  @ApiResponse({ status: 201, description: 'Medication administered' })
  async administerMedication(
    @Body() marData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bcmaService.administerMedication(marData, userId, tenantDb);
  }

  @Get('mar/patient/:patientId')
  @ApiOperation({ summary: 'Get MAR list for patient by date' })
  @ApiResponse({ status: 200, description: 'MAR list retrieved' })
  async getMARsByPatient(
    @Param('patientId') patientId: string,
    @Query('date') date: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const targetDate = date ? new Date(date) : new Date();
    return this.bcmaService.getMARsByPatient(patientId, targetDate, tenantDb);
  }

  @Post('mar/:id/hold')
  @ApiOperation({ summary: 'Hold medication administration' })
  @ApiResponse({ status: 200, description: 'Medication held' })
  async holdMedication(
    @Param('id') id: string,
    @Body() data: { reason: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bcmaService.holdMedication(id, data.reason, userId, tenantDb);
  }

  @Post('mar/:id/refuse')
  @ApiOperation({ summary: 'Patient refused medication' })
  @ApiResponse({ status: 200, description: 'Refusal documented' })
  async refuseMedication(
    @Param('id') id: string,
    @Body() data: { reason: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bcmaService.refuseMedication(id, data.reason, tenantDb);
  }

  // ==================== ALERTS ====================

  @Get('alerts/patient/:patientId')
  @ApiOperation({ summary: 'Get active medication alerts for patient' })
  @ApiResponse({ status: 200, description: 'Alerts retrieved' })
  async getActiveAlerts(
    @Param('patientId') patientId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bcmaService.getActiveAlerts(patientId, tenantDb);
  }

  @Post('alerts/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge medication alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() data: { overrideReason: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bcmaService.acknowledgeAlert(id, userId, data.overrideReason, tenantDb);
  }

  @Post('generate-mar/:prescriptionId')
  @ApiOperation({ summary: 'Generate scheduled MAR entries from prescription' })
  async generateMARFromPrescription(
    @Param('prescriptionId') prescriptionId: string,
    @Body() body: { patientId: string; admissionId?: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bcmaService.generateMARFromPrescription(
      prescriptionId,
      body.patientId,
      body.admissionId || null,
      tenantDb,
    );
  }

  @Get('mar/scheduled/:patientId')
  @ApiOperation({ summary: 'Get scheduled MAR entries for patient' })
  async getScheduledMARByPatient(
    @Param('patientId') patientId: string,
    @Query('date') date: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const targetDate = date ? new Date(date) : new Date();
    return this.bcmaService.getScheduledMARByPatient(patientId, targetDate, tenantDb);
  }

  @Post('mar/scheduled/:id/administer')
  @ApiOperation({ summary: 'Administer from scheduled entry (witness enforced if required)' })
  async administerFromScheduled(
    @Param('id') id: string,
    @Body() body: { witnessedById?: string; notes?: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bcmaService.administerFromScheduledEntry(id, body, userId, tenantDb);
  }
}

