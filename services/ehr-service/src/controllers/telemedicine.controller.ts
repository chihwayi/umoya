import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TelemedicineService } from '../services/telemedicine.service';
import { RemoteMonitoringService } from '../services/remote-monitoring.service';
import { TelemedicineConsentService } from '../services/telemedicine-consent.service';
import { DigitalPrescriptionService } from '../services/digital-prescription.service';
import {
  CreateTelemedicineConsultationDto,
  UpdateTelemedicineConsultationDto,
  JoinConsultationDto,
  RecordSatisfactionDto,
  TelemedicineConsultationQueryDto,
  CreateTelemedicineDeviceDto,
  UpdateTelemedicineDeviceDto,
  CreateTelemedicineConsentDto,
  UpdateTelemedicineConsentDto,
  CreateTechnicalLogDto,
  UpdateTechnicalLogDto,
  CreateRemoteMonitoringDto,
  UpdateRemoteMonitoringDto,
  RemoteMonitoringQueryDto,
  CreateDigitalPrescriptionDto,
  SignPrescriptionDto,
} from '../dto/telemedicine.dto';

@ApiTags('Telemedicine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telemedicine')
export class TelemedicineController {
  constructor(
    private readonly telemedicineService: TelemedicineService,
    private readonly remoteMonitoringService: RemoteMonitoringService,
    private readonly consentService: TelemedicineConsentService,
    private readonly digitalPrescriptionService: DigitalPrescriptionService,
  ) {}

  // ============================================
  // CONSULTATION ENDPOINTS
  // ============================================

  @Post('consultations')
  @ApiOperation({ summary: 'Create a new telemedicine consultation' })
  @ApiResponse({ status: 201, description: 'Consultation created successfully' })
  async createConsultation(
    @Body() dto: CreateTelemedicineConsultationDto,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.telemedicineService.createConsultation(req.tenantDb, dto, userId);
  }

  @Get('consultations')
  @ApiOperation({ summary: 'List telemedicine consultations' })
  @ApiResponse({ status: 200, description: 'Consultations retrieved successfully' })
  async listConsultations(
    @Query() query: TelemedicineConsultationQueryDto,
    @Req() req: RequestWithTenant,
  ) {
    return this.telemedicineService.listConsultations(req.tenantDb, query);
  }

  @Get('consultations/:id')
  @ApiOperation({ summary: 'Get consultation details' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 200, description: 'Consultation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Consultation not found' })
  async getConsultation(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.telemedicineService.getConsultation(req.tenantDb, id);
  }

  @Put('consultations/:id')
  @ApiOperation({ summary: 'Update consultation fields (scheduled time, type, notes). Status changes are validated via state machine.' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 200, description: 'Consultation updated successfully' })
  async updateConsultation(
    @Param('id') id: string,
    @Body() dto: UpdateTelemedicineConsultationDto,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.telemedicineService.updateConsultation(req.tenantDb, id, dto, userId);
  }

  @Post('consultations/:id/join')
  @ApiOperation({ summary: 'Join a consultation' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 200, description: 'Joined consultation successfully' })
  async joinConsultation(
    @Param('id') id: string,
    @Body() dto: JoinConsultationDto,
    @Req() req: RequestWithTenant,
  ) {
    return this.telemedicineService.joinConsultation(req.tenantDb, id, dto);
  }

  @Post('consultations/:id/end')
  @ApiOperation({ summary: 'End a consultation' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 200, description: 'Consultation ended successfully' })
  async endConsultation(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.telemedicineService.endConsultation(req.tenantDb, id, userId);
  }

  @Get('consultations/:id/meeting-url')
  @ApiOperation({ summary: 'Get meeting URL for consultation' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 200, description: 'Meeting URL retrieved successfully' })
  async getMeetingUrl(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.telemedicineService.getMeetingUrl(req.tenantDb, id);
  }

  @Get('consultations/:id/token')
  @ApiOperation({ summary: 'Get a signed Daily.co meeting token for the requesting participant' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiQuery({ name: 'role', enum: ['doctor', 'patient'], required: true })
  @ApiResponse({ status: 200, description: 'Meeting token returned' })
  async getMeetingToken(
    @Param('id') id: string,
    @Query('role') role: 'doctor' | 'patient',
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.telemedicineService.getMeetingToken(req.tenantDb, id, userId, role);
  }

  @Get('consultations/:id/status')
  @ApiOperation({ summary: 'Get live room status (participant count) from Daily.co' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 200, description: 'Room status from video provider' })
  async getRoomStatus(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.telemedicineService.getRoomStatus(req.tenantDb, id);
  }

  @Post('consultations/:id/technical-issue')
  @ApiOperation({ summary: 'Report a technical issue' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 201, description: 'Technical issue logged successfully' })
  async recordTechnicalIssue(
    @Param('id') id: string,
    @Body() dto: CreateTechnicalLogDto,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.telemedicineService.recordTechnicalIssue(
      req.tenantDb,
      id,
      dto.logType,
      dto.severity ?? 'medium',
      dto.description,
      userId,
    );
  }

  @Post('consultations/:id/satisfaction')
  @ApiOperation({ summary: 'Record patient satisfaction' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiResponse({ status: 200, description: 'Satisfaction recorded successfully' })
  async recordSatisfaction(
    @Param('id') id: string,
    @Body() dto: RecordSatisfactionDto,
    @Req() req: RequestWithTenant,
  ) {
    return this.telemedicineService.recordSatisfaction(req.tenantDb, id, dto);
  }

  @Post('consultations/:id/connection-quality')
  @ApiOperation({ summary: 'Update connection quality' })
  @ApiParam({ name: 'id', description: 'Consultation ID' })
  @ApiQuery({ name: 'role', enum: ['patient', 'doctor'] })
  @ApiQuery({ name: 'quality', enum: ['excellent', 'good', 'fair', 'poor'] })
  async updateConnectionQuality(
    @Param('id') id: string,
    @Query('role') role: 'patient' | 'doctor',
    @Query('quality') quality: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.telemedicineService.updateConnectionQuality(req.tenantDb, id, quality, role);
  }

  // ============================================
  // REMOTE MONITORING ENDPOINTS
  // ============================================

  @Post('monitoring/readings')
  @ApiOperation({ summary: 'Record a remote monitoring reading' })
  @ApiResponse({ status: 201, description: 'Reading recorded successfully' })
  async recordReading(
    @Body() dto: CreateRemoteMonitoringDto,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.remoteMonitoringService.recordReading(req.tenantDb, dto, userId);
  }

  @Get('monitoring/readings')
  @ApiOperation({ summary: 'Get remote monitoring readings' })
  @ApiResponse({ status: 200, description: 'Readings retrieved successfully' })
  async getReadings(@Query() query: RemoteMonitoringQueryDto, @Req() req: RequestWithTenant) {
    return this.remoteMonitoringService.getPatientReadings(req.tenantDb, query);
  }

  @Get('monitoring/trends')
  @ApiOperation({ summary: 'Get reading trends' })
  @ApiQuery({ name: 'patientId', required: true })
  @ApiQuery({ name: 'monitoringType', required: true })
  @ApiQuery({ name: 'period', enum: ['7d', '30d', '90d', '1y'], required: false, description: 'Time period for trends (default: 30d)' })
  async getTrends(
    @Query('patientId') patientId: string,
    @Query('monitoringType') monitoringType: string,
    @Query('period') period: '7d' | '30d' | '90d' | '1y' = '30d',
    @Req() req: RequestWithTenant,
  ) {
    return this.remoteMonitoringService.getReadingTrends(req.tenantDb, patientId, monitoringType, period);
  }

  @Get('monitoring/alerts')
  @ApiOperation({ summary: 'Get active monitoring alerts' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiResponse({ status: 200, description: 'Alerts retrieved successfully' })
  async getAlerts(@Query('patientId') patientId: string | undefined, @Req() req: RequestWithTenant) {
    return this.remoteMonitoringService.getActiveAlerts(req.tenantDb, patientId);
  }

  @Post('monitoring/setup')
  @ApiOperation({ summary: 'Setup monitoring for a patient' })
  @ApiResponse({ status: 200, description: 'Monitoring setup completed' })
  async setupMonitoring(
    @Body() body: { patientId: string; monitoringTypes: string[]; alertThresholds?: Record<string, any> },
    @Req() req: RequestWithTenant,
  ) {
    return this.remoteMonitoringService.setupMonitoring(req.tenantDb, body.patientId, {
      monitoringTypes: body.monitoringTypes,
      alertThresholds: body.alertThresholds,
    });
  }

  @Post('monitoring/sync')
  @ApiOperation({ summary: 'Sync device data' })
  @ApiResponse({ status: 200, description: 'Device data synced successfully' })
  async syncDeviceData(
    @Body() body: { patientId: string; deviceId: string; data: Array<any> },
    @Req() req: RequestWithTenant,
  ) {
    return this.remoteMonitoringService.syncDeviceData(req.tenantDb, body.patientId, body.deviceId, body.data);
  }

  // ============================================
  // CONSENT ENDPOINTS
  // ============================================

  @Post('consents')
  @ApiOperation({ summary: 'Grant telemedicine consent' })
  @ApiResponse({ status: 201, description: 'Consent granted successfully' })
  async grantConsent(@Body() dto: CreateTelemedicineConsentDto, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.consentService.grantConsent(req.tenantDb, dto, userId);
  }

  @Get('consents')
  @ApiOperation({ summary: 'Get consent history' })
  @ApiQuery({ name: 'patientId', required: true })
  @ApiResponse({ status: 200, description: 'Consent history retrieved successfully' })
  async getConsentHistory(@Query('patientId') patientId: string, @Req() req: RequestWithTenant) {
    return this.consentService.getConsentHistory(req.tenantDb, patientId);
  }

  @Get('consents/check')
  @ApiOperation({ summary: 'Check if patient has valid consent' })
  @ApiQuery({ name: 'patientId', required: true })
  @ApiQuery({ name: 'consentType', required: true })
  @ApiResponse({ status: 200, description: 'Consent status retrieved' })
  async checkConsent(
    @Query('patientId') patientId: string,
    @Query('consentType') consentType: string,
    @Req() req: RequestWithTenant,
  ) {
    const hasConsent = await this.consentService.checkConsent(req.tenantDb, patientId, consentType);
    return { hasConsent, patientId, consentType };
  }

  @Delete('consents/:id')
  @ApiOperation({ summary: 'Revoke consent' })
  @ApiParam({ name: 'id', description: 'Consent ID' })
  @ApiResponse({ status: 200, description: 'Consent revoked successfully' })
  async revokeConsent(
    @Param('id') id: string,
    @Query('reason') reason: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    return this.consentService.revokeConsent(req.tenantDb, id, reason);
  }

  @Post('consents/validate')
  @ApiOperation({ summary: 'Validate consent for consultation' })
  @ApiResponse({ status: 200, description: 'Consent validated' })
  async validateConsent(
    @Body() body: { patientId: string; consultationId: string },
    @Req() req: RequestWithTenant,
  ) {
    return this.consentService.validateConsent(req.tenantDb, body.patientId, body.consultationId);
  }

  // ============================================
  // DIGITAL PRESCRIPTION ENDPOINTS
  // ============================================

  @Post('prescriptions')
  @ApiOperation({ summary: 'Create digital prescription' })
  @ApiResponse({ status: 201, description: 'Digital prescription created successfully' })
  async createDigitalPrescription(
    @Body() dto: CreateDigitalPrescriptionDto,
    @Req() req: RequestWithTenant,
  ) {
    return this.digitalPrescriptionService.createDigitalPrescription(req.tenantDb, dto);
  }

  @Post('prescriptions/:id/sign')
  @ApiOperation({ summary: 'Sign prescription' })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiResponse({ status: 200, description: 'Prescription signed successfully' })
  async signPrescription(
    @Param('id') id: string,
    @Body() dto: SignPrescriptionDto,
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.digitalPrescriptionService.signPrescription(req.tenantDb, id, dto, userId);
  }

  @Get('prescriptions/:id/validate')
  @ApiOperation({ summary: 'Validate prescription signatures' })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiResponse({ status: 200, description: 'Prescription validation result' })
  async validatePrescription(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.digitalPrescriptionService.validatePrescription(req.tenantDb, id);
  }

  @Get('prescriptions/:id/pdf')
  @ApiOperation({ summary: 'Generate prescription PDF' })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiResponse({ status: 200, description: 'PDF URL generated' })
  async generatePDF(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const pdfUrl = await this.digitalPrescriptionService.generatePrescriptionPDF(req.tenantDb, id);
    return { pdfUrl };
  }

  @Post('prescriptions/:id/send-pharmacy')
  @ApiOperation({ summary: 'Send prescription to pharmacy' })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  @ApiQuery({ name: 'pharmacyId', required: false })
  @ApiResponse({ status: 200, description: 'Prescription sent to pharmacy' })
  async sendToPharmacy(
    @Param('id') id: string,
    @Query('pharmacyId') pharmacyId: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    return this.digitalPrescriptionService.sendPrescriptionToPharmacy(req.tenantDb, id, pharmacyId);
  }
}

