import { Controller, Get, Post, Put, Body, UseGuards, Req, Query, Param, Delete, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { PatientAuthService, PatientRegisterDto, PatientLoginDto, PatientPasswordResetDto, PatientPasswordResetConfirmDto } from '../services/patient-auth.service';
import { PatientPortalService } from '../services/patient-portal.service';
import { PatientMessagingService } from '../services/patient-messaging.service';
import { PatientNotificationsService } from '../services/patient-notifications.service';
import { PatientPortalAppointmentService } from '../services/patient-portal-appointment.service';
import { PatientVitalsSubmissionService } from '../services/patient-vitals-submission.service';
import { PrescriptionPdfService } from '../services/prescription-pdf.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Patient Portal')
@Controller('patient-portal')
export class PatientPortalController {
  constructor(
    private readonly patientAuthService: PatientAuthService,
    private readonly patientPortalService: PatientPortalService,
    private readonly patientMessagingService: PatientMessagingService,
    private readonly patientNotificationsService: PatientNotificationsService,
    private readonly patientPortalAppointmentService: PatientPortalAppointmentService,
    private readonly prescriptionPdfService: PrescriptionPdfService,
    private readonly patientVitalsSubmissionService: PatientVitalsSubmissionService,
    private readonly telemedicineService: TelemedicineService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register for patient portal', description: 'Allow patients to register for portal access' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  async register(@Body() registerDto: PatientRegisterDto, @Req() req: RequestWithTenant) {
    return this.patientAuthService.register(registerDto, req.tenantId);
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
  async getAvailableTimeSlots(
    @Query('doctorId') doctorId: string,
    @Query('date') date: string,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.patientPortalAppointmentService.getAvailableTimeSlots(doctorId, date, req.tenantId);
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
    const patientId = req.user.sub;
    return this.patientPortalService.getPatientRecords(patientId, req.tenantId, { startDate, endDate, type });
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
    const patientId = req.user.sub;
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
    const patientId = req.user.sub;
    
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
    const patientId = req.user.sub;
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
    const consultations = await this.telemedicineService.listConsultations(req.tenantDb, { appointmentId });
    if (consultations.length === 0) {
      throw new Error('Telemedicine consultation not found for this appointment');
    }

    return consultations[0];
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
    return this.telemedicineService.joinConsultation(req.tenantDb, consultationId, { role: 'patient' });
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
      body.subject,
      (body.messageType as any) || 'general',
      (body.priority as any) || 'normal',
      req.tenantId,
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
}

