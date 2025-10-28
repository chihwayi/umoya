import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { MockAuthService } from '../services/mock-auth.service';
import { LoginDto } from '../dto/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('auth')
export class MockAuthController {
  constructor(private readonly authService: MockAuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return { message: 'Tenant ID is required', error: 'Bad Request', statusCode: 400 };
    }

    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      return { message: 'Invalid credentials', error: 'Unauthorized', statusCode: 401 };
    }

    return this.authService.login(user);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return req.user;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    return { message: 'Logged out successfully' };
  }
}


