import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { WebAuthnService } from '../services/webauthn.service';

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(private readonly webAuthn: WebAuthnService) {}

  @Post('register/options')
  @UseGuards(JwtAuthGuard)
  getRegistrationOptions(@Req() req: any) {
    return this.webAuthn.generateRegistrationOptions(req.user?.sub, req.user?.email, req.tenantDb);
  }

  @Post('register/verify')
  @UseGuards(JwtAuthGuard)
  verifyRegistration(@Body() body: { response: any; deviceName: string }, @Req() req: any) {
    return this.webAuthn.verifyRegistration(req.user?.sub, body.response, body.deviceName, req.tenantDb);
  }

  @Post('authenticate/options')
  getAuthenticationOptions(@Body() body: { userId: string }, @Req() req: any) {
    return this.webAuthn.generateAuthenticationOptions(body.userId, req.tenantDb);
  }

  @Post('authenticate/verify')
  async verifyAuthentication(@Body() body: { userId: string; response: any }, @Req() req: any) {
    const verified = await this.webAuthn.verifyAuthentication(body.userId, body.response, req.tenantDb);
    return { verified };
  }

  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  listCredentials(@Req() req: any) {
    return this.webAuthn.listCredentials(req.user?.sub, req.tenantDb);
  }

  @Delete('credentials/:id')
  @UseGuards(JwtAuthGuard)
  removeCredential(@Param('id') id: string, @Req() req: any) {
    return this.webAuthn.removeCredential(id, req.user?.sub, req.tenantDb);
  }
}
