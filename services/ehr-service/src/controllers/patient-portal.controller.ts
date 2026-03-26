import { Controller, Get, Post, Put, Body, UseGuards, Req, Query, Param, Delete, Res, Logger, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import { PatientAuthService, PatientRegisterDto, PatientLoginDto, PatientPasswordResetDto, PatientPasswordResetConfirmDto } from '../services/patient-auth.service';
import { PatientPortalService } from '../services/patient-portal.service';
import { PatientMessagingService } from '../services/patient-messaging.service';
import { PatientNotificationsService } from '../services/patient-notifications.service';
import { PatientPortalAppointmentService } from '../services/patient-portal-appointment.service';
import { PatientVitalsSubmissionService } from '../services/patient-vitals-submission.service';
import { PrescriptionPdfService } from '../services/prescription-pdf.service';
import { TelemedicineService } from '../services/telemedicine.service';
import { HealthRecordsExportService } from '../services/health-records-export.service';
import { PatientProService } from '../services/patient-pro.service';
import { AssignQuestionnaireDto, SubmitQuestionnaireDto } from '../dto/patient-pro.dto';
import { CreatePostVisitCompanionMessageDto, PostVisitCompanionAcknowledgementDto } from '../dto/post-visit.dto';
import { HealthGoalsService, CreateGoalDto, UpdateGoalDto, LogProgressDto } from '../services/health-goals.service';
import { CarePlanService } from '../services/care-plan.service';
import { PostVisitService } from '../services/post-visit.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
// Tier 1 Services
import { PatientConsentService } from '../services/patient-consent.service';
import { ClinicalPathwayService } from '../services/clinical-pathway.service';
import { ImmunizationService } from '../services/immunization.service';
import { ADTService } from '../services/adt.service';
import { EDService } from '../services/ed.service';
import { TenantService } from '../services/tenant.service';
import { PatientPortalH3Service } from '../services/patient-portal-h3.service';

import { SignerRole, SignatureType } from '../dto/consent.dto';

@ApiTags('Patient Portal')
@Controller('patient-portal')
export class PatientPortalController {
  private readonly logger = new Logger(PatientPortalController.name);

  constructor(
    private readonly patientAuthService: PatientAuthService,
    private readonly patientPortalService: PatientPortalService,
    private readonly patientMessagingService: PatientMessagingService,
    private readonly patientNotificationsService: PatientNotificationsService,
    private readonly patientPortalAppointmentService: PatientPortalAppointmentService,
    private readonly prescriptionPdfService: PrescriptionPdfService,
    private readonly patientVitalsSubmissionService: PatientVitalsSubmissionService,
    private readonly telemedicineService: TelemedicineService,
    private readonly healthRecordsExportService: HealthRecordsExportService,
    private readonly patientProService: PatientProService,
    private readonly healthGoalsService: HealthGoalsService,
    private readonly carePlanService: CarePlanService,
    private readonly postVisitService: PostVisitService,
    // Tier 1 Services
    private readonly patientConsentService: PatientConsentService,
    private readonly clinicalPathwayService: ClinicalPathwayService,
    private readonly immunizationService: ImmunizationService,
    private readonly adtService: ADTService,
    private readonly edService: EDService,
    private readonly tenantService: TenantService,
    private readonly patientPortalH3Service: PatientPortalH3Service,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register for patient portal', description: 'Allow patients to register for portal access' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  async register(@Body() registerDto: PatientRegisterDto, @Req() req: RequestWithTenant) {
    return this.patientAuthService.register(registerDto, req.tenantId);
  }

  @Post('register/assess')
  @ApiOperation({ summary: 'Assess patient portal registration readiness', description: 'Run registration-intelligence checks before creating the portal account' })
  @ApiResponse({ status: 200, description: 'Registration readiness assessed' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  async assessRegistration(@Body() registerDto: PatientRegisterDto, @Req() req: RequestWithTenant) {
    return this.patientAuthService.assessRegistration(registerDto, req.tenantId);
  }

  @Post('login')
  @ApiOperation({ summary: 'Patient portal login', description: 'Login to patient portal' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: PatientLoginDto, @Req() req: RequestWithTenant) {
    return this.patientAuthService.login(loginDto, req.tenantId);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address', description: 'Verify patient email using verification token' })
  @ApiQuery({ name: 'token', description: 'Email verification token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Query('token') token: string, @Req() req: RequestWithTenant) {
    return this.patientAuthService.verifyEmail(token, req.tenantId);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset', description: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async requestPasswordReset(@Body() resetDto: PatientPasswordResetDto, @Req() req: RequestWithTenant) {
    return this.patientAuthService.requestPasswordReset(resetDto, req.tenantId);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password', description: 'Reset password using reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async confirmPasswordReset(@Body() resetDto: PatientPasswordResetConfirmDto, @Req() req: RequestWithTenant) {
    return this.patientAuthService.confirmPasswordReset(resetDto, req.tenantId);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient profile', description: 'Get logged-in patient profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientAuthService.getPatientProfile(patientId, req.tenantId);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update patient profile', description: 'Update logged-in patient profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Body() updateData: any, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientAuthService.updatePatientProfile(patientId, updateData, req.tenantId);
  }

  @Post('link-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link portal account to patient record', description: 'Verify identity and link portal account to patient record' })
  @ApiResponse({ status: 200, description: 'Account linked successfully' })
  @ApiResponse({ status: 400, description: 'Verification failed' })
  async linkAccount(@Body() linkData: { patientNumber: string; dateOfBirth: string; nationalId?: string; phone?: string }, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientAuthService.linkAccount(patientId, linkData, req.tenantId);
  }

  // Appointments
  @Get('appointments/available-doctors')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available doctors', description: 'Get list of available doctors for appointment booking' })
  async getAvailableDoctors(@Req() req: RequestWithTenant & { user: any }) {
    return this.patientPortalAppointmentService.getAvailableDoctors(req.tenantId);
  }

  @Get('appointments/available-slots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available time slots', description: 'Get available time slots for a doctor on a specific date' })
  @ApiQuery({ name: 'doctorId', required: true, description: 'Doctor ID' })
  @ApiQuery({ name: 'date', required: true, description: 'Date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'includeStates', required: false, description: 'Include full slot state payload (available/booked/unavailable/past)' })
  async getAvailableTimeSlots(
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
    @Query('includeStates') includeStates: string,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const payload = await this.patientPortalAppointmentService.getAvailableTimeSlots(doctorId, date, req.tenantId);
    const withStates = String(includeStates || '').toLowerCase() === 'true';
    return withStates ? payload : payload.availableSlots;
  }

  @Get('appointments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient appointments', description: 'Get all appointments for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  async getAppointments(@Req() req: RequestWithTenant & { user: any }, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('status') status?: string) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    const appointments = await this.patientPortalService.getPatientAppointments(patientId, req.tenantId, { startDate, endDate, status });
    return appointments; // Return array directly
  }

  @Get('appointments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get appointment details', description: 'Get details of a specific appointment' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  async getAppointment(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientPortalService.getPatientAppointment(patientId, id, req.tenantId);
  }

  @Post('appointments/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request appointment', description: 'Request a new appointment (without payment)' })
  async requestAppointment(@Body() appointmentData: any, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientPortalService.requestAppointment(patientId, appointmentData, req.tenantId);
  }

  @Post('appointments/request-with-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request appointment with payment', description: 'Request a new appointment and pay for it immediately' })
  @ApiResponse({ status: 201, description: 'Appointment requested and payment processed' })
  @ApiResponse({ status: 400, description: 'Invalid appointment or payment data' })
  async requestAppointmentWithPayment(
    @Body() body: {
      appointment: {
        doctorId: string;
        appointmentDate: string;
        reason: string;
        durationMinutes?: number;
        appointmentType?: string;
        notes?: string;
        isTelehealth?: boolean;
      };
      payment: {
        method: 'ecocash' | 'onemoney' | 'cash' | 'card';
        phoneNumber?: string;
        amount: number;
        currency?: string;
      };
    },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalAppointmentService.requestAppointmentWithPayment(
      patientId,
      body.appointment,
      body.payment,
      req.tenantId,
    );
  }

  // ==================== H3: Bills / Payments / Education / Family Access ====================

  @Post('payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create patient portal payment record' })
  async createPortalPayment(
    @Body()
    body: {
      billId?: string;
      amount: number;
      paymentMethod: 'ecocash' | 'onemoney' | 'card' | 'bank_transfer';
      paymentReference?: string;
    },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientPortalH3Service.createPortalPayment(patientId, body, req.tenantDb);
  }

  @Get('education')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Browse published health education content' })
  async listEducation(
    @Query('category') category: string | undefined,
    @Query('language') language: string | undefined,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.patientPortalH3Service.listEducation(req.tenantDb, { category, language, publishedOnly: true });
  }

  @Get('education/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a health education content item' })
  async getEducation(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    return this.patientPortalH3Service.getEducationById(req.tenantDb, id);
  }

  @Get('family-access')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List family/caregiver access grants' })
  async listFamilyAccess(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientPortalH3Service.listFamilyAccess(patientId, req.tenantDb);
  }

  @Post('family-access')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create family/caregiver access grant' })
  async createFamilyAccess(
    @Body()
    body: {
      proxyName: string;
      proxyEmail: string;
      proxyPhone?: string;
      relationship?: string;
      accessLevel?: 'view_only' | 'full' | 'emergency_only';
      expiresAt?: string;
    },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientPortalH3Service.createFamilyAccess(patientId, body, req.tenantDb);
  }

  @Delete('family-access/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke family/caregiver access grant' })
  async revokeFamilyAccess(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientPortalH3Service.revokeFamilyAccess(patientId, id, req.tenantDb);
  }


  @Delete('appointments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel appointment', description: 'Cancel an appointment' })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  async cancelAppointment(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientPortalService.cancelAppointment(patientId, id, req.tenantId);
  }

  // Medical Records
  @Get('records')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient medical records', description: 'Get medical records for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by record type' })
  async getRecords(@Req() req: RequestWithTenant & { user: any }, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('type') type?: string) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      this.logger.error(`[getRecords] No patient ID found in token. User object: ${JSON.stringify(req.user)}`);
      throw new Error('Patient ID not found in token');
    }
    this.logger.log(`[getRecords] Patient ID from token: ${patientId}, Tenant ID: ${req.tenantId}, User object: ${JSON.stringify(req.user)}`);
    
    // Debug: Check if patient exists and has records
    try {
      if (req.tenantDb) {
        const patientCheck = await req.tenantDb.query(`SELECT id, first_name, last_name FROM patients WHERE id = $1`, [patientId]);
        this.logger.log(`[getRecords] Patient check result: ${JSON.stringify(patientCheck)}`);
        
        const recordCount = await req.tenantDb.query(`SELECT COUNT(*) as count FROM medical_records WHERE patient_id = $1`, [patientId]);
        this.logger.log(`[getRecords] Record count for patient ${patientId}: ${JSON.stringify(recordCount)}`);
        
        // Test the exact query
        const testQuery = await req.tenantDb.query(
          `SELECT id, visit_date, chief_complaint FROM medical_records WHERE patient_id = $1 LIMIT 1`,
          [patientId]
        );
        this.logger.log(`[getRecords] Test query result: ${JSON.stringify(testQuery)}`);
      }
    } catch (debugError: any) {
      this.logger.error(`[getRecords] Debug query error: ${debugError.message || debugError}`);
    }
    
    try {
      const result = await this.patientPortalService.getPatientRecords(patientId, req.tenantId, { startDate, endDate, type });
      this.logger.log(`[getRecords] Service returned ${result.length} records`);
      this.logger.log(`[getRecords] First record sample: ${JSON.stringify(result[0] || null)}`);
      return result;
    } catch (serviceError: any) {
      this.logger.error(`[getRecords] Service error: ${serviceError.message || serviceError}`);
      throw serviceError;
    }
  }

  // Lab Results
  @Get('lab-results')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient lab results', description: 'Get lab results for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  async getLabResults(@Req() req: RequestWithTenant & { user: any }, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const patientId = req.user.sub;
    return this.patientPortalService.getPatientLabResults(patientId, req.tenantId, { startDate, endDate });
  }

  // Prescriptions
  @Get('prescriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient prescriptions', description: 'Get prescriptions for the logged-in patient' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, description: 'Get only active prescriptions' })
  async getPrescriptions(@Req() req: RequestWithTenant & { user: any }, @Query('activeOnly') activeOnly?: string) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientPrescriptions(patientId, req.tenantId, { activeOnly: activeOnly === 'true' });
  }

  @Get('prescriptions/:id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download prescription as PDF', description: 'Download prescription PDF for the logged-in patient' })
  @ApiParam({ name: 'id', description: 'Prescription ID' })
  async downloadPrescription(
    @Param('id') id: string,
    @Req() req: RequestWithTenant & { user: any },
    @Res() res: Response,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      return res.status(401).json({ message: 'Patient ID not found in token' });
    }
    
    // Verify prescription belongs to patient
    const prescriptions = await this.patientPortalService.getPatientPrescriptions(patientId, req.tenantId, {});
    const prescription = prescriptions.find((p: any) => p.id === id);
    
    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    try {
      const { buffer, fileName } = await this.prescriptionPdfService.generatePrescriptionPDF(
        req.tenantDb,
        id,
      );

      // Log download for audit
      await req.tenantDb.query(
        `INSERT INTO prescription_downloads (prescription_id, downloaded_by, downloaded_at, user_type)
         VALUES ($1, $2, NOW(), $3)`,
        [id, patientId, 'patient'],
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Failed to generate prescription PDF' });
      }
    }
  }

  // Bills
  @Get('bills')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient bills', description: 'Get bills for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by payment status' })
  async getBills(@Req() req: RequestWithTenant & { user: any }, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('status') status?: string) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientBills(patientId, req.tenantId, { startDate, endDate, status });
  }

  @Get('bills/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bill details', description: 'Get details of a specific bill' })
  @ApiParam({ name: 'id', description: 'Bill ID' })
  async getBill(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientPortalService.getPatientBill(patientId, id, req.tenantId);
  }

  @Get('bills/:id/quote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient bill quote', description: 'Get patient-responsibility guidance and quote signals for a specific bill' })
  @ApiParam({ name: 'id', description: 'Bill ID' })
  async getBillQuote(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientPortalService.getPatientBillQuote(patientId, id, req.tenantId);
  }

  // Vitals
  @Get('vitals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient vitals', description: 'Get vital signs records for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of records' })
  async getVitals(@Req() req: RequestWithTenant & { user: any }, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('limit') limit?: string) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    const vitals = await this.patientPortalService.getPatientVitals(patientId, req.tenantId, { 
      startDate, 
      endDate, 
      limit: limit ? parseInt(limit) : undefined
    });
    return vitals; // Return array directly
  }

  @Post('vitals/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit patient vitals', description: 'Submit vital signs from patient portal' })
  async submitVitals(@Body() vitalsData: any, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientVitalsSubmissionService.submitPatientVitals(patientId, vitalsData, req.tenantId);
  }

  // Telemedicine
  @Get('telemedicine/consultation/:appointmentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get telemedicine consultation by appointment ID', description: 'Get consultation details for a telehealth appointment' })
  @ApiParam({ name: 'appointmentId', description: 'Appointment ID' })
  async getConsultationByAppointment(@Param('appointmentId') appointmentId: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }

    // Verify appointment belongs to patient
    const appointment = await this.patientPortalService.getPatientAppointment(patientId, appointmentId, req.tenantId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Get consultation by appointment ID
    const result = await this.telemedicineService.listConsultations(req.tenantDb, { appointmentId });
    if (result.consultations.length === 0) {
      throw new Error('Telemedicine consultation not found for this appointment');
    }

    return result.consultations[0];
  }

  @Post('telemedicine/consultation/:consultationId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join telemedicine consultation', description: 'Join a video consultation as patient' })
  @ApiParam({ name: 'consultationId', description: 'Consultation ID' })
  async joinConsultation(@Param('consultationId') consultationId: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }

    // Verify consultation belongs to patient
    const consultation = await this.telemedicineService.getConsultation(req.tenantDb, consultationId);
    if (consultation.patient_id !== patientId) {
      throw new Error('You do not have access to this consultation');
    }

    // Join consultation
    return this.telemedicineService.joinConsultation(req.tenantDb, consultationId, { userId: patientId, role: 'patient' });
  }

  @Get('telemedicine/consultation/:consultationId/meeting-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get meeting URL for consultation', description: 'Get video meeting URL and password' })
  @ApiParam({ name: 'consultationId', description: 'Consultation ID' })
  async getMeetingUrl(@Param('consultationId') consultationId: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }

    // Verify consultation belongs to patient
    const consultation = await this.telemedicineService.getConsultation(req.tenantDb, consultationId);
    if (consultation.patient_id !== patientId) {
      throw new Error('You do not have access to this consultation');
    }

    return this.telemedicineService.getMeetingUrl(req.tenantDb, consultationId);
  }

  // Dashboard Summary
  @Get('dashboard/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard summary', description: 'Get summary statistics and quick info for patient dashboard' })
  async getDashboardSummary(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientDashboardSummary(patientId, req.tenantId);
  }

  @Get('patient-ai/followups')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient AI follow-ups', description: 'Get active and historical patient-facing AI follow-up tasks for the authenticated patient' })
  async getPatientAiFollowups(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientAiFollowups(patientId, req.tenantId);
  }

  @Put('patient-ai/followups/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update patient AI follow-up state', description: 'Allow the authenticated patient to acknowledge or complete an AI-guided follow-up task' })
  @ApiParam({ name: 'id', description: 'Patient follow-up orchestration ID' })
  async updatePatientAiFollowup(
    @Param('id') id: string,
    @Body() body: { status?: 'open' | 'in_progress' | 'completed' | 'dismissed'; reminderState?: 'pending' | 'sent' | 'acknowledged' },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.updatePatientAiFollowup(patientId, req.tenantId, id, body);
  }

  // Post-Visit AI Companion
  @Get('post-visit/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List published post-visit sessions', description: 'List doctor-published post-visit sessions available for patient companion access' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination' })
  async listPostVisitSessions(
    @Req() req: RequestWithTenant & { user: any },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.postVisitService.listPatientSessions(req.tenantDb, patientId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('post-visit/sessions/:id/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get post-visit summary + checklist', description: 'Fetch approved patient-safe summary and actionable checklist for one post-visit session' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  async getPostVisitSummary(
    @Param('id') id: string,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.postVisitService.getPatientSessionSummary(req.tenantDb, id, patientId);
  }

  @Get('post-visit/sessions/:id/lab-trends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get lab observation trends for session', description: 'Returns aggregated lab trends from document intelligence for published session (patient own)' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  async getPostVisitLabTrends(
    @Param('id') id: string,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    const session = await this.postVisitService.getSessionForPatient(id, patientId, req.tenantDb);
    if (!session || session.status !== 'published') {
      throw new NotFoundException('Session not found or not published');
    }
    return this.postVisitService.getSessionLabTrends(req.tenantDb, id);
  }

  @Get('post-visit/sessions/:id/recording-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get signed URL for session recording (patient)', description: 'Returns signed URL for playback when session is published; for mobile app use' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  async getPatientRecordingUrl(
    @Param('id') id: string,
    @Req() req: RequestWithTenant & { user: any },
  ): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    const session = await this.postVisitService.getSessionForPatient(id, patientId, req.tenantDb);
    if (!session || session.status !== 'published') {
      return { url: null };
    }
    return this.postVisitService.getSessionRecordingUrl(id, req.tenantDb);
  }

  @Get('post-visit/sessions/:id/summary/annotated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get annotated summary (patient)', description: 'Entity-annotated draft for published session; for mobile app use' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  async getPatientAnnotatedSummary(
    @Param('id') id: string,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    const session = await this.postVisitService.getSessionForPatient(id, patientId, req.tenantDb);
    if (!session || session.status !== 'published') {
      throw new NotFoundException('Session not found or not published');
    }
    return this.postVisitService.getAnnotatedDraft(id, req.tenantDb);
  }

  @Post('post-visit/sessions/:id/ask-section')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ask about section (patient)', description: 'Section-scoped Q&A for published session; for mobile app use' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  async patientAskAboutSection(
    @Param('id') id: string,
    @Body() body: { question: string; sectionType: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    const session = await this.postVisitService.getSessionForPatient(id, patientId, req.tenantDb);
    if (!session || session.status !== 'published') {
      throw new NotFoundException('Session not found or not published');
    }
    return this.postVisitService.askAboutSection(id, { question: body.question, sectionType: body.sectionType }, req.tenantDb);
  }

  @Get('post-visit/sessions/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get companion messages', description: 'List grounded patient companion conversation messages for a published post-visit session' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination' })
  async getPostVisitMessages(
    @Param('id') id: string,
    @Req() req: RequestWithTenant & { user: any },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.postVisitService.listCompanionMessages(req.tenantDb, id, patientId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('post-visit/sessions/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send companion message', description: 'Send patient message to post-visit companion and receive grounded response with safety escalation detection' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  async sendPostVisitMessage(
    @Param('id') id: string,
    @Body() body: CreatePostVisitCompanionMessageDto,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.postVisitService.sendCompanionMessage(req.tenantDb, id, patientId, body, {
      tenantId: req.tenantId,
    });
  }

  @Post('post-visit/sessions/:id/acknowledgements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record post-visit acknowledgement', description: 'Capture teach-back or adherence acknowledgement events from patient companion flow' })
  @ApiParam({ name: 'id', description: 'Post-visit session ID' })
  async acknowledgePostVisit(
    @Param('id') id: string,
    @Body() body: PostVisitCompanionAcknowledgementDto,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.postVisitService.recordCompanionAcknowledgement(req.tenantDb, id, patientId, body);
  }

  // Messages
  @Get('messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient messages', description: 'Get all messages for the logged-in patient' })
  @ApiQuery({ name: 'read', required: false, type: Boolean, description: 'Filter by read status' })
  @ApiQuery({ name: 'messageType', required: false, description: 'Filter by message type' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination' })
  async getMessages(
    @Req() req: RequestWithTenant & { user: any },
    @Query('read') read?: string,
    @Query('messageType') messageType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientMessagingService.getPatientMessages(patientId, req.tenantId, {
      read: read === 'true' ? true : read === 'false' ? false : undefined,
      messageType: messageType as any,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('messages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get message details', description: 'Get details of a specific message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  async getMessage(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientMessagingService.getMessage(id, patientId, req.tenantId);
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message', description: 'Send a message to clinic staff' })
  async sendMessage(
    @Body() body: { recipientId: string; recipientType: string; message: string; subject?: string; messageType?: string; priority?: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientMessagingService.sendMessage(
      patientId,
      body.recipientId,
      body.recipientType as any,
      body.message,
      req.tenantId,
      body.subject,
      (body.messageType as any) || 'general',
      (body.priority as any) || 'normal',
    );
  }

  @Put('messages/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark message as read', description: 'Mark a message as read' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  async markMessageAsRead(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    await this.patientMessagingService.markAsRead(id, patientId, req.tenantId);
    return { success: true };
  }

  @Put('messages/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all messages as read', description: 'Mark all messages as read' })
  async markAllMessagesAsRead(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    await this.patientMessagingService.markAllAsRead(patientId, req.tenantId);
    return { success: true };
  }

  @Delete('messages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a message', description: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  async deleteMessage(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    await this.patientMessagingService.deleteMessage(id, patientId, req.tenantId);
    return { success: true };
  }

  // Notifications
  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient notifications', description: 'Get all notifications for the logged-in patient' })
  @ApiQuery({ name: 'read', required: false, type: Boolean, description: 'Filter by read status' })
  @ApiQuery({ name: 'notificationType', required: false, description: 'Filter by notification type' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results' })
  async getNotifications(
    @Req() req: RequestWithTenant & { user: any },
    @Query('read') read?: string,
    @Query('notificationType') notificationType?: string,
    @Query('limit') limit?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    return this.patientNotificationsService.getPatientNotifications(patientId, req.tenantId, {
      read: read === 'true' ? true : read === 'false' ? false : undefined,
      notificationType: notificationType as any,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Put('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read', description: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async markNotificationAsRead(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    await this.patientNotificationsService.markAsRead(id, patientId, req.tenantId);
    return { success: true };
  }

  @Put('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read', description: 'Mark all notifications as read' })
  async markAllNotificationsAsRead(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    await this.patientNotificationsService.markAllAsRead(patientId, req.tenantId);
    return { success: true };
  }

  @Delete('notifications/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a notification', description: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async deleteNotification(@Param('id') id: string, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    await this.patientNotificationsService.deleteNotification(id, patientId, req.tenantId);
    return { success: true };
  }

  // Chronic Disease Management - Diabetes
  @Get('diabetes/registry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient diabetes registry', description: 'Get diabetes registry information for the logged-in patient' })
  async getDiabetesRegistry(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientDiabetesRegistry(patientId, req.tenantId);
  }

  @Get('diabetes/glucose-history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient glucose history', description: 'Get glucose readings history for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  async getGlucoseHistory(
    @Req() req: RequestWithTenant & { user: any },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientGlucoseHistory(patientId, req.tenantId, {
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('diabetes/care-plan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient diabetes care plan', description: 'Get care plan and medications for the logged-in patient' })
  async getDiabetesCarePlan(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientDiabetesCarePlan(patientId, req.tenantId);
  }

  @Get('diabetes/medications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient diabetes medications', description: 'Get diabetes medications for the logged-in patient' })
  async getDiabetesMedications(@Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientDiabetesMedications(patientId, req.tenantId);
  }

  // Chronic Disease Management - Cardiology/Hypertension
  @Get('cardiology/encounters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient cardiology encounters', description: 'Get cardiology encounter history for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  async getCardiologyEncounters(
    @Req() req: RequestWithTenant & { user: any },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientCardiologyEncounters(patientId, req.tenantId, {
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('cardiology/blood-pressure-trends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient blood pressure trends', description: 'Get blood pressure trend data for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  async getBloodPressureTrends(
    @Req() req: RequestWithTenant & { user: any },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getPatientBloodPressureTrends(patientId, req.tenantId, {
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ============================================
  // MEDICATION MANAGEMENT - REFILL REQUESTS
  // ============================================

  @Post('prescriptions/:prescriptionId/refill-request')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Request prescription refill', description: 'Submit a refill request for a prescription' })
  @ApiParam({ name: 'prescriptionId', description: 'Prescription ID' })
  @ApiResponse({ status: 201, description: 'Refill request created successfully' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async createRefillRequest(
    @Param('prescriptionId') prescriptionId: string,
    @Body() body: { requestedQuantity?: number; reason?: string; urgency?: string },
    @Req() req: RequestWithTenant,
  ) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.createRefillRequest(patientId, req.tenantId, prescriptionId, body);
  }

  @Get('prescriptions/refill-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get refill requests', description: 'Get all refill requests for the patient' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (pending, approved, rejected, cancelled)' })
  @ApiResponse({ status: 200, description: 'Refill requests retrieved successfully' })
  async getRefillRequests(@Req() req: RequestWithTenant, @Query('status') status?: string) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getRefillRequests(patientId, req.tenantId, { status });
  }

  @Delete('prescriptions/refill-requests/:requestId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel refill request', description: 'Cancel a pending refill request' })
  @ApiParam({ name: 'requestId', description: 'Refill request ID' })
  @ApiResponse({ status: 200, description: 'Refill request cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Refill request not found' })
  async cancelRefillRequest(@Param('requestId') requestId: string, @Req() req: RequestWithTenant) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    await this.patientPortalService.cancelRefillRequest(patientId, req.tenantId, requestId);
    return { message: 'Refill request cancelled successfully' };
  }

  // ============================================
  // MEDICATION MANAGEMENT - REMINDERS
  // ============================================

  @Post('prescriptions/:prescriptionId/reminders')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create medication reminder', description: 'Create a reminder for medication intake' })
  @ApiParam({ name: 'prescriptionId', description: 'Prescription ID' })
  @ApiResponse({ status: 201, description: 'Medication reminder created successfully' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async createMedicationReminder(
    @Param('prescriptionId') prescriptionId: string,
    @Body() body: { reminderTime: string; reminderDays: number[]; reminderType?: string; timezone?: string },
    @Req() req: RequestWithTenant,
  ) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.createMedicationReminder(patientId, req.tenantId, prescriptionId, body);
  }

  @Get('prescriptions/reminders')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get medication reminders', description: 'Get all medication reminders for the patient' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, description: 'Filter only active reminders' })
  @ApiResponse({ status: 200, description: 'Medication reminders retrieved successfully' })
  async getMedicationReminders(@Req() req: RequestWithTenant, @Query('activeOnly') activeOnly?: string) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getMedicationReminders(patientId, req.tenantId, {
      activeOnly: activeOnly === 'true',
    });
  }

  @Put('prescriptions/reminders/:reminderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update medication reminder', description: 'Update a medication reminder' })
  @ApiParam({ name: 'reminderId', description: 'Reminder ID' })
  @ApiResponse({ status: 200, description: 'Medication reminder updated successfully' })
  @ApiResponse({ status: 404, description: 'Medication reminder not found' })
  async updateMedicationReminder(
    @Param('reminderId') reminderId: string,
    @Body() body: { reminderTime?: string; reminderDays?: number[]; reminderType?: string; isActive?: boolean },
    @Req() req: RequestWithTenant,
  ) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.updateMedicationReminder(patientId, req.tenantId, reminderId, body);
  }

  @Delete('prescriptions/reminders/:reminderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete medication reminder', description: 'Delete a medication reminder' })
  @ApiParam({ name: 'reminderId', description: 'Reminder ID' })
  @ApiResponse({ status: 200, description: 'Medication reminder deleted successfully' })
  @ApiResponse({ status: 404, description: 'Medication reminder not found' })
  async deleteMedicationReminder(@Param('reminderId') reminderId: string, @Req() req: RequestWithTenant) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    await this.patientPortalService.deleteMedicationReminder(patientId, req.tenantId, reminderId);
    return { message: 'Medication reminder deleted successfully' };
  }

  // ============================================
  // MEDICATION MANAGEMENT - ADHERENCE TRACKING
  // ============================================

  @Post('prescriptions/:prescriptionId/adherence')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Log medication adherence', description: 'Log whether medication was taken or missed' })
  @ApiParam({ name: 'prescriptionId', description: 'Prescription ID' })
  @ApiResponse({ status: 201, description: 'Adherence logged successfully' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async logMedicationAdherence(
    @Param('prescriptionId') prescriptionId: string,
    @Body() body: { scheduledTime: string; taken: boolean; takenTime?: string; missedReason?: string; notes?: string },
    @Req() req: RequestWithTenant,
  ) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.logMedicationAdherence(patientId, req.tenantId, prescriptionId, body);
  }

  @Get('prescriptions/adherence/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get adherence summary', description: 'Get medication adherence summary statistics' })
  @ApiQuery({ name: 'prescriptionId', required: false, description: 'Filter by prescription ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for summary period' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for summary period' })
  @ApiResponse({ status: 200, description: 'Adherence summary retrieved successfully' })
  async getMedicationAdherenceSummary(
    @Req() req: RequestWithTenant,
    @Query('prescriptionId') prescriptionId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getMedicationAdherenceSummary(patientId, req.tenantId, prescriptionId, {
      startDate,
      endDate,
    });
  }

  @Get('prescriptions/adherence/logs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get adherence logs', description: 'Get detailed medication adherence logs' })
  @ApiQuery({ name: 'prescriptionId', required: false, description: 'Filter by prescription ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for logs' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of results' })
  @ApiResponse({ status: 200, description: 'Adherence logs retrieved successfully' })
  async getMedicationAdherenceLogs(
    @Req() req: RequestWithTenant,
    @Query('prescriptionId') prescriptionId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const patientId = (req.user as any)?.sub || (req.user as any)?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    return this.patientPortalService.getMedicationAdherenceLogs(patientId, req.tenantId, prescriptionId, {
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // Health Records Export
  @Post('export/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export complete medical record as PDF', description: 'Generate and download complete medical record PDF' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for export range' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for export range' })
  @ApiResponse({ status: 200, description: 'PDF export generated successfully' })
  async exportMedicalRecordPdf(
    @Req() req: RequestWithTenant & { user: any },
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      return res.status(401).json({ message: 'Patient ID not found in token' });
    }
    this.logger.log(`[exportMedicalRecordPdf] Patient ID: ${patientId}, Tenant ID: ${req.tenantId}`);

    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    try {
      const result = await this.healthRecordsExportService.exportCompleteMedicalRecordPdf(
        patientId,
        req.tenantId,
        { startDate, endDate },
        patientId,
        ipAddress,
        userAgent,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="medical-record-${patientId}-${Date.now()}.pdf"`);
      res.setHeader('Content-Length', result.fileSize);

      const fileStream = fs.createReadStream(result.filePath);
      fileStream.pipe(res);

      // Clean up file after streaming
      fileStream.on('end', () => {
        try {
          fs.unlinkSync(result.filePath);
        } catch (unlinkError) {
          this.logger.warn(`[exportMedicalRecordPdf] Failed to delete temp file: ${unlinkError}`);
        }
      });
    } catch (error: any) {
      this.logger.error(`[exportMedicalRecordPdf] Export failed: ${error.message}`, error.stack);
      res.status(500).json({ error: error.message || 'Failed to generate PDF export' });
    }
  }

  @Get('export/fhir')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export medical records as FHIR Bundle', description: 'Export patient data in FHIR R4 format' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for export range' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for export range' })
  @ApiResponse({ status: 200, description: 'FHIR bundle exported successfully' })
  async exportFhirBundle(
    @Req() req: RequestWithTenant & { user: any },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    this.logger.log(`[exportFhirBundle] Patient ID: ${patientId}, Tenant ID: ${req.tenantId}`);

    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    try {
      const result = await this.healthRecordsExportService.exportFhirBundle(
        patientId,
        req.tenantId,
        { startDate, endDate },
        patientId,
        ipAddress,
        userAgent,
      );

      return result.data;
    } catch (error: any) {
      this.logger.error(`[exportFhirBundle] Export failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('export/json')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export medical records as JSON', description: 'Export patient data in JSON format' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for export range' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for export range' })
  @ApiResponse({ status: 200, description: 'JSON export generated successfully' })
  async exportJson(
    @Req() req: RequestWithTenant & { user: any },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    this.logger.log(`[exportJson] Patient ID: ${patientId}, Tenant ID: ${req.tenantId}`);

    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    try {
      const result = await this.healthRecordsExportService.exportJson(
        patientId,
        req.tenantId,
        { startDate, endDate },
        patientId,
        ipAddress,
        userAgent,
      );

      return result.data;
    } catch (error: any) {
      this.logger.error(`[exportJson] Export failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('export/csv')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export medical records as CSV', description: 'Export patient data in CSV format' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for export range' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for export range' })
  @ApiQuery({ name: 'dataType', required: false, description: 'Type of data to export (appointments, prescriptions, lab_results, vitals)' })
  @ApiResponse({ status: 200, description: 'CSV export generated successfully' })
  async exportCsv(
    @Req() req: RequestWithTenant & { user: any },
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dataType') dataType?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      return res.status(401).json({ message: 'Patient ID not found in token' });
    }
    this.logger.log(`[exportCsv] Patient ID: ${patientId}, Tenant ID: ${req.tenantId}`);

    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    try {
      const result = await this.healthRecordsExportService.exportCsv(
        patientId,
        req.tenantId,
        { startDate, endDate, dataType },
        patientId,
        ipAddress,
        userAgent,
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="medical-records-${patientId}-${Date.now()}.csv"`);
      res.send(result.csv);
    } catch (error: any) {
      this.logger.error(`[exportCsv] Export failed: ${error.message}`, error.stack);
      res.status(500).json({ error: error.message || 'Failed to generate CSV export' });
    }
  }

  // ==================== Patient-Reported Outcomes (PROs) ====================
  // NOTE: Specific routes MUST come before parameterized routes to avoid route conflicts

  @Get('questionnaires/available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available questionnaires', description: 'List all available questionnaires for the patient' })
  @ApiResponse({ status: 200, description: 'Questionnaires retrieved successfully' })
  async getAvailableQuestionnaires(@Req() req: RequestWithTenant & { user: { sub?: string; id?: string } }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      this.logger.error(`[getAvailableQuestionnaires] No patient ID found in token. User object: ${JSON.stringify(req.user)}`);
      throw new Error('Patient ID not found in token');
    }
    this.logger.debug(`[getAvailableQuestionnaires] Patient ID: ${patientId}`);
    return this.patientProService.getAvailableQuestionnaires(req.tenantDb, patientId);
  }

  @Get('questionnaires/pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending questionnaires', description: 'Get questionnaires assigned to patient that are pending completion' })
  @ApiResponse({ status: 200, description: 'Pending questionnaires retrieved successfully' })
  async getPendingQuestionnaires(@Req() req: RequestWithTenant & { user: { sub?: string; id?: string } }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      this.logger.error(`[getPendingQuestionnaires] No patient ID found in token. User object: ${JSON.stringify(req.user)}`);
      throw new Error('Patient ID not found in token');
    }
    this.logger.debug(`[getPendingQuestionnaires] Patient ID: ${patientId}`);
    return this.patientProService.getPendingQuestionnaires(req.tenantDb, patientId);
  }

  @Get('questionnaires/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get questionnaire history', description: 'Get patient questionnaire completion history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of results' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'Questionnaire history retrieved successfully' })
  async getQuestionnaireHistory(
    @Req() req: RequestWithTenant & { user: { sub?: string; id?: string } },
    @Query('limit') limit?: number,
    @Query('category') category?: string,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      this.logger.error(`[getQuestionnaireHistory] No patient ID found in token. User object: ${JSON.stringify(req.user)}`);
      throw new Error('Patient ID not found in token');
    }
    this.logger.debug(`[getQuestionnaireHistory] Patient ID: ${patientId}`);
    return this.patientProService.getPatientQuestionnaireHistory(req.tenantDb, patientId, {
      limit: limit ? parseInt(String(limit), 10) : undefined,
      category,
    });
  }

  @Post('questionnaires/initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize standard questionnaires', description: 'Initialize standard questionnaires (PHQ-9, GAD-7, etc.) in the tenant database. This should be called once per tenant.' })
  @ApiResponse({ status: 200, description: 'Standard questionnaires initialized successfully' })
  async initializeStandardQuestionnaires(@Req() req: RequestWithTenant) {
    await this.patientProService.initializeStandardQuestionnaires(req.tenantDb);
    return { message: 'Standard questionnaires initialized successfully' };
  }

  // IMPORTANT: Specific routes must come BEFORE parameterized routes
  // to prevent route conflicts (e.g., /schedules matching /:questionnaireId)
  @Get('questionnaires/trends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get PRO trends', description: 'Get PRO score trends over time for the patient' })
  @ApiQuery({ name: 'questionnaireCode', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'PRO trends retrieved successfully' })
  async getProTrends(
    @Req() req: RequestWithTenant & { user: { sub?: string; id?: string } },
    @Query('questionnaireCode') questionnaireCode?: string,
    @Query('limit') limit?: number,
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      this.logger.error(`[getProTrends] No patient ID found in token. User object: ${JSON.stringify(req.user)}`);
      throw new Error('Patient ID not found in token');
    }
    this.logger.debug(`[getProTrends] Patient ID: ${patientId}`);
    return this.patientProService.getProTrends(
      req.tenantDb,
      patientId,
      questionnaireCode,
      limit ? parseInt(String(limit), 10) : 10,
    );
  }

  @Get('questionnaires/schedules')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get questionnaire schedules', description: 'Get all scheduled questionnaires for the patient' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  async getSchedules(@Req() req: RequestWithTenant & { user: { sub?: string; id?: string } }) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      this.logger.error(`[getSchedules] No patient ID found in token. User object: ${JSON.stringify(req.user)}`);
      throw new Error('Patient ID not found in token');
    }
    this.logger.debug(`[getSchedules] Patient ID: ${patientId}`);
    return this.patientProService.getPatientSchedules(req.tenantDb, patientId);
  }

  @Get('questionnaires/:questionnaireId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get questionnaire details', description: 'Get questionnaire template and patient assignment details' })
  @ApiParam({ name: 'questionnaireId', description: 'Patient questionnaire ID' })
  @ApiResponse({ status: 200, description: 'Questionnaire retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Questionnaire not found' })
  async getQuestionnaire(
    @Param('questionnaireId') questionnaireId: string,
    @Req() req: RequestWithTenant & { user: { sub?: string; id?: string } },
  ) {
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      this.logger.error(`[getQuestionnaire] No patient ID found in token. User object: ${JSON.stringify(req.user)}`);
      throw new Error('Patient ID not found in token');
    }
    this.logger.debug(`[getQuestionnaire] Patient ID: ${patientId}, Questionnaire ID: ${questionnaireId}`);
    return this.patientProService.getPatientQuestionnaire(req.tenantDb, questionnaireId, patientId);
  }

  @Post('questionnaires/:questionnaireId/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit questionnaire responses', description: 'Submit answers to a questionnaire' })
  @ApiParam({ name: 'questionnaireId', description: 'Patient questionnaire ID' })
  @ApiResponse({ status: 200, description: 'Questionnaire submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid responses or questionnaire already completed' })
  async submitQuestionnaire(
    @Param('questionnaireId') questionnaireId: string,
    @Body() submitDto: SubmitQuestionnaireDto,
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    // Extract patient ID - try both sub and id fields
    const patientId = req.user?.sub || req.user?.id;
    if (!patientId) {
      throw new Error('Patient ID not found in token');
    }
    this.logger.debug(`Submitting questionnaire ${questionnaireId} for patient ${patientId}`);
    return this.patientProService.submitQuestionnaireResponses(
      req.tenantDb,
      questionnaireId,
      patientId,
      submitDto.responses,
    );
  }

  @Get('appointments/:appointmentId/questionnaires')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pre-visit questionnaires for an appointment', description: 'Get questionnaires assigned for a specific appointment' })
  @ApiParam({ name: 'appointmentId', description: 'Appointment ID' })
  @ApiResponse({ status: 200, description: 'Pre-visit questionnaires retrieved successfully' })
  async getPreVisitQuestionnaires(
    @Param('appointmentId') appointmentId: string,
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    const patientId = req.user.sub;
    return this.patientProService.getPreVisitQuestionnaires(req.tenantDb, appointmentId, patientId);
  }

  // Health Goals Endpoints
  @Post('goals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a health goal', description: 'Create a new health goal for the patient' })
  @ApiResponse({ status: 201, description: 'Goal created successfully' })
  async createGoal(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Body() dto: CreateGoalDto,
  ) {
    const patientId = req.user.sub;
    return this.healthGoalsService.createGoal(req.tenantDb, patientId, dto);
  }

  @Get('goals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient goals', description: 'Get all health goals for the patient' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'completed', 'paused', 'cancelled', 'failed'] })
  @ApiResponse({ status: 200, description: 'Goals retrieved successfully' })
  async getGoals(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Query('status') status?: string,
  ) {
    const patientId = req.user.sub;
    return this.healthGoalsService.getPatientGoals(req.tenantDb, patientId, status);
  }

  @Get('goals/:goalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific goal', description: 'Get details of a specific health goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal retrieved successfully' })
  async getGoal(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('goalId') goalId: string,
  ) {
    return this.healthGoalsService.getGoalById(req.tenantDb, goalId);
  }

  @Put('goals/:goalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a health goal', description: 'Update an existing health goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal updated successfully' })
  async updateGoal(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.healthGoalsService.updateGoal(req.tenantDb, goalId, dto);
  }

  @Delete('goals/:goalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a health goal', description: 'Delete a health goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal deleted successfully' })
  async deleteGoal(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('goalId') goalId: string,
  ) {
    return this.healthGoalsService.deleteGoal(req.tenantDb, goalId);
  }

  @Post('goals/:goalId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log progress for a goal', description: 'Log progress towards a health goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Progress logged successfully' })
  async logProgress(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('goalId') goalId: string,
    @Body() dto: LogProgressDto,
  ) {
    const patientId = req.user.sub;
    return this.healthGoalsService.logProgress(req.tenantDb, goalId, patientId, dto);
  }

  @Get('goals/:goalId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get progress logs for a goal', description: 'Get all progress logs for a health goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Progress logs retrieved successfully' })
  async getProgressLogs(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('goalId') goalId: string,
    @Query('limit') limit?: number,
  ) {
    return this.healthGoalsService.getProgressLogs(req.tenantDb, goalId, limit ? parseInt(String(limit), 10) : undefined);
  }

  @Get('achievements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient achievements', description: 'Get all achievements earned by the patient' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Achievements retrieved successfully' })
  async getAchievements(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Query('limit') limit?: number,
  ) {
    const patientId = req.user.sub;
    return this.healthGoalsService.getPatientAchievements(req.tenantDb, patientId, limit ? parseInt(String(limit), 10) : undefined);
  }

  @Get('streaks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient streaks', description: 'Get all active streaks for the patient' })
  @ApiResponse({ status: 200, description: 'Streaks retrieved successfully' })
  async getStreaks(@Req() req: RequestWithTenant & { user: { sub: string } }) {
    const patientId = req.user.sub;
    return this.healthGoalsService.getPatientStreaks(req.tenantDb, patientId);
  }

  // ==================== Care Plans ====================
  @Get('care-plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient care plans', description: 'Get all care plans for the logged-in patient' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Care plans retrieved successfully' })
  async getCarePlans(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Query('status') status?: string,
  ) {
    const patientId = req.user.sub;
    return this.carePlanService.getCarePlans(patientId, { status }, req.tenantDb);
  }

  @Get('care-plans/:carePlanId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get care plan details', description: 'Get detailed information about a specific care plan' })
  @ApiParam({ name: 'carePlanId', description: 'Care Plan ID' })
  @ApiResponse({ status: 200, description: 'Care plan retrieved successfully' })
  async getCarePlan(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('carePlanId') carePlanId: string,
  ) {
    return this.carePlanService.getCarePlanById(carePlanId, req.tenantDb);
  }

  @Post('care-plans/:carePlanId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report care plan progress', description: 'Patient can report progress on their care plan' })
  @ApiParam({ name: 'carePlanId', description: 'Care Plan ID' })
  @ApiResponse({ status: 201, description: 'Progress reported successfully' })
  async reportCarePlanProgress(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('carePlanId') carePlanId: string,
    @Body() progressData: { notes: string; metrics?: any },
  ) {
    return this.carePlanService.updateCarePlan(carePlanId, { notes: progressData.notes }, req.tenantDb);
  }

  @Post('care-plans/:carePlanId/goals/:goalId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report goal progress', description: 'Patient can report progress on a specific goal' })
  @ApiParam({ name: 'carePlanId', description: 'Care Plan ID' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 201, description: 'Goal progress reported successfully' })
  async reportGoalProgress(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('carePlanId') carePlanId: string,
    @Param('goalId') goalId: string,
    @Body() progressData: { currentValue: number; notes?: string; metrics?: any },
  ) {
    return this.carePlanService.updateGoal(goalId, { 
      currentValue: progressData.currentValue,
      notes: progressData.notes 
    }, req.tenantDb);
  }

  // ==================== TIER 1: E-CONSENT MANAGEMENT ====================

  @Get('consents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient consents' })
  async getPatientConsents(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Query('status') status?: string,
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    let query = `
      SELECT 
        id,
        consent_number,
        template_id,
        template_version,
        consent_type,
        appointment_id,
        procedure_id,
        title,
        content,
        status,
        language_code,
        consent_date,
        valid_from,
        valid_until,
        signed_at,
        declined_at,
        decline_reason,
        revoked_at,
        revocation_reason,
        revoked_by,
        notes,
        created_at,
        updated_at
      FROM patient_consents
      WHERE patient_id = $1
    `;
    
    const params: any[] = [patientId];
    
    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    return await tenantDb.query(query, params);
  }

  @Get('consents/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get consent by ID' })
  async getConsentById(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('id') consentId: string,
  ) {
    const patientId = req.user.sub;
    const consent = await this.patientConsentService.getConsentById(consentId, req.tenantDb as DataSource);
    
    // Verify patient owns this consent
    if (consent.patientId !== patientId) {
      throw new Error('Access denied');
    }
    
    return consent;
  }

  @Post('consents/:id/sign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign consent' })
  async signConsent(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('id') consentId: string,
    @Body() signatureData: { signatureData: string; signedBy: string },
  ) {
    const patientId = req.user.sub;
    const tenantDb = req.tenantDb as DataSource;
    
    // Verify patient owns this consent
    const consent = await this.patientConsentService.getConsentById(consentId, tenantDb);
    if (consent.patientId !== patientId) {
      throw new Error('Access denied');
    }
    
    return await this.patientConsentService.signConsent(
      consentId,
      {
        signatureData: signatureData.signatureData,
        signerName: 'Patient', // Self-signed
        signerRole: SignerRole.PATIENT,
        signatureType: SignatureType.TYPED,
        signatureMethod: 'typed',
      },
      patientId,
      req.ip || '',
      (req.headers['user-agent'] as string) || '',
      tenantDb,
    );
  }

  @Post('consents/:id/decline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Decline consent' })
  async declineConsent(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('id') consentId: string,
    @Body() declineData: { reason: string },
  ) {
    const patientId = req.user.sub;
    const tenantDb = req.tenantDb as DataSource;
    
    // Verify patient owns this consent
    const consent = await this.patientConsentService.getConsentById(consentId, tenantDb);
    if (consent.patientId !== patientId) {
      throw new Error('Access denied');
    }
    
    return await this.patientConsentService.declineConsent(
      consentId,
      { reason: declineData.reason },
      patientId,
      req.ip || '',
      (req.headers['user-agent'] as string) || '',
      tenantDb,
    );
  }

  @Get('consents/:id/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export consent as PDF' })
  async exportConsent(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('id') consentId: string,
    @Query('format') format: 'pdf' | 'json' = 'pdf',
    @Res() res: Response,
  ) {
    const patientId = req.user.sub;
    const tenantDb = req.tenantDb as DataSource;
    
    // Verify patient owns this consent
    const consent = await this.patientConsentService.getConsentById(consentId, tenantDb);
    if (consent.patientId !== patientId) {
      throw new Error('Access denied');
    }
    
    const exported = await this.patientConsentService.exportConsent(
        consentId,
        format,
        patientId,
        req.ip || '',
        (req.headers['user-agent'] as string) || '',
        tenantDb
    );
    
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="consent-${consentId}.pdf"`);
      res.send(exported);
    } else {
      res.json(exported);
    }
  }

  // ==================== TIER 1: CLINICAL PATHWAYS ====================

  @Get('pathways')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient pathway enrollments' })
  async getPatientPathways(
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    const enrollments = await tenantDb.query(`
      SELECT 
        pe.id,
        pe.pathway_id,
        cp.pathway_name,
        cp.condition,
        cp.specialty,
        cp.description,
        pe.enrolled_date,
        pe.expected_end_date as expected_completion_date,
        pe.actual_end_date as actual_completion_date,
        pe.enrollment_status as status,
        pe.adherence_score,
        pe.current_step,
        (SELECT COUNT(*) FROM pathway_steps WHERE pathway_id = pe.pathway_id) as total_steps,
        (SELECT COUNT(*) FROM pathway_adherence WHERE enrollment_id = pe.id AND status = 'completed') as completed_steps
      FROM pathway_enrollments pe
      JOIN clinical_pathways cp ON pe.pathway_id = cp.id
      WHERE pe.patient_id = $1
      ORDER BY pe.enrolled_date DESC
    `, [patientId]);
    
    return enrollments;
  }

  @Get('pathways/:enrollmentId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pathway progress details' })
  async getPathwayProgress(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('enrollmentId') enrollmentId: string,
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    // Verify patient owns this enrollment
    const [enrollment] = await tenantDb.query(
      'SELECT patient_id FROM pathway_enrollments WHERE id = $1',
      [enrollmentId],
    );
    
    if (!enrollment || enrollment.patient_id !== patientId) {
      throw new Error('Access denied');
    }
    
    const steps = await tenantDb.query(`
      SELECT 
        ps.id,
        ps.step_number,
        ps.description,
        ps.timing_from_start_hours,
        ps.required_actions,
        ps.decision_criteria,
        ps.step_type,
        CASE WHEN pa.status = 'completed' THEN true ELSE false END as is_completed,
        pa.completed_date
      FROM pathway_steps ps
      LEFT JOIN pathway_adherence pa ON ps.id = pa.step_id AND pa.enrollment_id = $1
      WHERE ps.pathway_id = (SELECT pathway_id FROM pathway_enrollments WHERE id = $1)
      ORDER BY ps.step_number ASC
    `, [enrollmentId]);
    
    return { enrollmentId, steps };
  }

  // ==================== TIER 1: IMMUNIZATIONS ====================

  @Get('immunizations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient immunization history' })
  async getPatientImmunizations(
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    const immunizations = await tenantDb.query(`
      SELECT 
        i.id,
        i.immunization_number,
        i.vaccine_code,
        i.vaccine_name,
        i.manufacturer,
        i.lot_number,
        i.administration_date,
        i.administration_time,
        i.dose_number,
        i.route,
        i.site,
        i.completion_status,
        i.notes,
        i.reaction_observed,
        i.reaction_details,
        u.first_name || ' ' || u.last_name as administered_by_name
      FROM immunizations i
      LEFT JOIN users u ON i.administered_by = u.id
      WHERE i.patient_id = $1
      ORDER BY i.administration_date DESC
    `, [patientId]);
    
    return immunizations;
  }

  @Get('immunizations/forecast')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get immunization forecast' })
  async getImmunizationForecast(
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    // Get patient date of birth and already administered vaccines
    const patients = await tenantDb.query(
      'SELECT date_of_birth FROM patients WHERE id = $1',
      [patientId],
    );
    
    if (!patients || patients.length === 0) {
      return { forecast: [] };
    }
    
    const patient = patients[0];
    
    const forecast = await tenantDb.query(`
      SELECT 
        s.id,
        s.vaccine_name,
        s.vaccine_code,
        s.recommended_age_months,
        s.dose_number,
        s.notes as schedule_notes,
        s.is_required,
        CASE 
          WHEN i.id IS NOT NULL THEN 'completed'
          WHEN (EXTRACT(YEAR FROM age(CURRENT_DATE, $2)) * 12 + EXTRACT(MONTH FROM age(CURRENT_DATE, $2))) >= s.recommended_age_months THEN 'due'
          ELSE 'upcoming'
        END as status,
        i.administration_date as completed_date
      FROM immunization_schedules s
      LEFT JOIN immunizations i ON i.patient_id = $1 
        AND i.vaccine_code = s.vaccine_code 
        AND i.dose_number = s.dose_number
      ORDER BY s.recommended_age_months ASC, s.dose_number ASC
    `, [patientId, patient.date_of_birth]);
    
    return { forecast };
  }

  @Get('immunizations/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export immunization record' })
  async exportImmunizationRecord(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Query('format') format: 'pdf' | 'json' = 'pdf',
    @Res() res: Response,
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    const immunizations = await tenantDb.query(`
      SELECT * FROM immunizations WHERE patient_id = $1 ORDER BY administration_date DESC
    `, [patientId]);
    
    const [patient] = await tenantDb.query(
      'SELECT first_name, last_name, patient_number, date_of_birth FROM patients WHERE id = $1',
      [patientId],
    );
    
    if (format === 'pdf') {
      // Simple PDF generation (you can enhance this with a proper PDF library)
      const pdfContent = `
        IMMUNIZATION RECORD
        
        Patient: ${patient.first_name} ${patient.last_name}
        Patient Number: ${patient.patient_number}
        Date of Birth: ${patient.date_of_birth}
        
        Immunizations:
        ${immunizations.map((imm: any) => `
        - ${imm.vaccineName} (${imm.vaccineCode})
          Date: ${imm.administrationDate}
          Dose: ${imm.doseNumber || 'N/A'}
          Administered by: ${imm.administeredByName || 'N/A'}
        `).join('\n')}
      `;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="immunization-record-${patient.patient_number}.pdf"`);
      res.send(Buffer.from(pdfContent));
    } else {
      res.json({ patient, immunizations });
    }
  }

  // ==================== TIER 1: ADMISSION STATUS ====================

  @Get('admission/current')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current admission status' })
  async getCurrentAdmission(
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    const [admission] = await tenantDb.query(`
      SELECT 
        a.id,
        a.admission_number,
        a.admission_date,
        a.expected_discharge_date,
        a.actual_discharge_date,
        a.admission_type,
        a.admission_source,
        a.admission_diagnosis,
        a.admission_diagnosis_icd10,
        a.admission_reason,
        a.status,
        a.length_of_stay_days,
        json_build_object(
          'bed_number', b.bed_number,
          'room_number', b.room_number,
          'ward_name', b.ward_name,
          'floor', b.floor,
          'bed_type', b.bed_type
        ) as assigned_bed,
        u.first_name || ' ' || u.last_name as attending_doctor_name
      FROM admissions a
      LEFT JOIN beds b ON a.current_bed_id = b.id
      LEFT JOIN users u ON a.attending_provider = u.id
      WHERE a.patient_id = $1 
        AND a.admission_status = 'active'
      ORDER BY a.admission_date DESC
      LIMIT 1
    `, [patientId]);
    
    return admission || null;
  }

  @Get('admission/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admission history' })
  async getAdmissionHistory(
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    const admissions = await tenantDb.query(`
      SELECT 
        a.id,
        a.admission_number,
        a.admission_date,
        a.estimated_discharge_date as expected_discharge_date,
        d.discharge_date as actual_discharge_date,
        a.admission_type,
        a.primary_diagnosis as admission_diagnosis,
        a.admission_reason,
        a.admission_status as status,
        a.length_of_stay_days
      FROM admissions a
      LEFT JOIN discharges d ON a.id = d.admission_id
      WHERE a.patient_id = $1
        AND a.admission_status IN ('discharged', 'transferred_out')
      ORDER BY admission_date DESC
      LIMIT 20
    `, [patientId]);
    
    return admissions;
  }

  // ==================== TIER 1: ED VISITS ====================

  @Get('ed-visits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient ED visit history' })
  async getPatientEDVisits(
    @Req() req: RequestWithTenant & { user: { sub: string } },
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    const visits = await tenantDb.query(`
      SELECT 
        ev.id,
        ev.ed_visit_number,
        ev.arrival_date,
        ev.arrival_time,
        ev.arrival_mode,
        ev.chief_complaint,
        ev.chief_complaint_snomed,
        ev.ed_status,
        ev.triage_level,
        ev.triage_acuity,
        ed.disposition,
        ed.discharge_diagnosis,
        ed.discharge_diagnosis_icd10,
        ed.discharge_instructions
      FROM ed_visits ev
      LEFT JOIN ed_dispositions ed ON ev.id = ed.ed_visit_id
      WHERE ev.patient_id = $1
      ORDER BY ev.arrival_date DESC, ev.arrival_time DESC
      LIMIT 20
    `, [patientId]);
    
    return visits;
  }

  @Get('ed-visits/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ED visit details' })
  async getEDVisitDetails(
    @Req() req: RequestWithTenant & { user: { sub: string } },
    @Param('id') visitId: string,
  ) {
    const patientId = req.user.sub;
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    
    const [visit] = await tenantDb.query(`
      SELECT 
        ev.*,
        ed.disposition,
        ed.discharge_diagnosis,
        ed.discharge_diagnosis_icd10,
        ed.discharge_instructions,
        ed.follow_up_instructions
      FROM ed_visits ev
      LEFT JOIN ed_dispositions ed ON ev.id = ed.ed_visit_id
      WHERE ev.id = $1 AND ev.patient_id = $2
    `, [visitId, patientId]);
    
    if (!visit) {
      throw new Error('ED visit not found or access denied');
    }

    return visit;
  }

  // ── AI Health Insights ─────────────────────────────────────────────────────

  @Get('ai-insights')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get AI-generated personalised health insights for the logged-in patient' })
  async getHealthInsights(@Req() req: any) {
    const patientId: string = req.user?.patientId || req.user?.id;
    const tenantId: string = req.tenantId || req.headers?.['x-tenant-id'];
    return this.patientPortalService.getPatientHealthInsights(patientId, tenantId);
  }
}
