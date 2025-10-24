import { Controller, Post, Body, Request, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, LoginDto } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Request() req) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Request() req,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    await this.authService.changePassword(
      req.user.id,
      body.oldPassword,
      body.newPassword
    );
    
    return { message: 'Password changed successfully' };
  }
}