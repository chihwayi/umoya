import { Controller, Get, Post, Put, Body, UseGuards, Req, Query, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PatientAuthService, PatientRegisterDto, PatientLoginDto, PatientPasswordResetDto, PatientPasswordResetConfirmDto } from '../services/patient-auth.service';
import { PatientPortalService } from '../services/patient-portal.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Patient Portal')
@Controller('patient-portal')
export class PatientPortalController {
  constructor(
    private readonly patientAuthService: PatientAuthService,
    private readonly patientPortalService: PatientPortalService,
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
  @Get('appointments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get patient appointments', description: 'Get all appointments for the logged-in patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter to date' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  async getAppointments(@Req() req: RequestWithTenant & { user: any }, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('status') status?: string) {
    const patientId = req.user.sub;
    return this.patientPortalService.getPatientAppointments(patientId, req.tenantId, { startDate, endDate, status });
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
  @ApiOperation({ summary: 'Request appointment', description: 'Request a new appointment' })
  async requestAppointment(@Body() appointmentData: any, @Req() req: RequestWithTenant & { user: any }) {
    const patientId = req.user.sub;
    return this.patientPortalService.requestAppointment(patientId, appointmentData, req.tenantId);
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
}

