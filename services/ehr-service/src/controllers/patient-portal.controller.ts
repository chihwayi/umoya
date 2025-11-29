import { Controller, Get, Post, Put, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PatientAuthService, PatientRegisterDto, PatientLoginDto, PatientPasswordResetDto, PatientPasswordResetConfirmDto } from '../services/patient-auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Patient Portal')
@Controller('patient-portal')
export class PatientPortalController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

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
}

