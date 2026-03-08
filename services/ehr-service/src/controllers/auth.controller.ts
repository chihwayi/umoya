import { Controller, Post, Body, UseGuards, Request, Get, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LoginDto, ChangePasswordDto } from '../dto/auth.dto';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('EHR Authentication')
@ApiSecurity('tenant-key')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'EHR user login with password change check' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 423, description: 'Must change password' })
  async login(@Body() loginDto: LoginDto, @Request() req: RequestWithTenant) {
    const ipAddress = (req as any).ip || (req as any).connection?.remoteAddress;
    const userAgent = (req as any).get('User-Agent');
    
    return this.authService.login(loginDto, req.tenantDb, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @Request() req: RequestWithTenant,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    await this.authService.changePassword(
      (req.user as any).id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
      req.tenantDb
    );
    
    return { message: 'Password changed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('force-password-change')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Force password change for first login' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async forcePasswordChange(
    @Request() req: RequestWithTenant,
    @Body() body: { newPassword: string }
  ) {
    await this.authService.forcePasswordChange(
      (req.user as any).id,
      body.newPassword,
      req.tenantDb
    );
    
    return { message: 'Password changed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP secret and QR code URL for 2FA setup' })
  async setup2FA(@Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.authService.setup2FA(userId, req.tenantDb);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify TOTP code and enable 2FA' })
  async verify2FA(@Request() req: RequestWithTenant, @Body() body: { code: string }) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await this.authService.verify2FA(userId, body.code, req.tenantDb);
    return { message: '2FA enabled successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA (requires current TOTP code)' })
  async disable2FA(@Request() req: RequestWithTenant, @Body() body: { code: string }) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    await this.authService.disable2FA(userId, body.code, req.tenantDb);
    return { message: '2FA disabled successfully' };
  }

  @Post('2fa/complete-login')
  @ApiOperation({ summary: 'Complete login with TOTP code after requiresTwoFactor' })
  async complete2FALogin(@Request() req: RequestWithTenant, @Body() body: { tempToken: string; code: string }) {
    return this.authService.complete2FALogin(body.tempToken, body.code, req.tenantDb);
  }
}