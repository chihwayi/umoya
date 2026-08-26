import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { PreVisitIntakeService } from '../services/pre-visit-intake.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('intake')
export class PreVisitIntakeController {
  constructor(private readonly intake: PreVisitIntakeService) {}

  // :token routes stay unguarded by design — patient fills the form via a shared
  // link before login, the token itself is the credential.
  @Get(':token')
  async getForm(@Req() req: any, @Param('token') token: string) {
    return this.intake.getFormByToken(req.tenantDb, token);
  }

  @Post(':token/submit')
  async submitForm(@Req() req: any, @Param('token') token: string, @Body() body: any) {
    return this.intake.submitForm(req.tenantDb, token, body);
  }

  @Get('status/:appointmentId')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any, @Param('appointmentId') appointmentId: string) {
    return this.intake.getIntakeStatus(req.tenantDb, appointmentId);
  }

  @Post('sync/:appointmentId/:encounterId')
  @UseGuards(JwtAuthGuard)
  async syncToEncounter(
    @Req() req: any,
    @Param('appointmentId') appointmentId: string,
    @Param('encounterId') encounterId: string,
  ) {
    await this.intake.syncToEncounter(req.tenantDb, appointmentId, encounterId);
    return { ok: true };
  }
}
