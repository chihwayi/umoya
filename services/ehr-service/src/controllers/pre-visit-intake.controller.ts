import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { PreVisitIntakeService } from '../services/pre-visit-intake.service';

@Controller('intake')
export class PreVisitIntakeController {
  constructor(private readonly intake: PreVisitIntakeService) {}

  @Get(':token')
  async getForm(@Req() req: any, @Param('token') token: string) {
    return this.intake.getFormByToken(req.tenantDb, token);
  }

  @Post(':token/submit')
  async submitForm(@Req() req: any, @Param('token') token: string, @Body() body: any) {
    return this.intake.submitForm(req.tenantDb, token, body);
  }

  @Get('status/:appointmentId')
  async getStatus(@Req() req: any, @Param('appointmentId') appointmentId: string) {
    return this.intake.getIntakeStatus(req.tenantDb, appointmentId);
  }

  @Post('sync/:appointmentId/:encounterId')
  async syncToEncounter(
    @Req() req: any,
    @Param('appointmentId') appointmentId: string,
    @Param('encounterId') encounterId: string,
  ) {
    await this.intake.syncToEncounter(req.tenantDb, appointmentId, encounterId);
    return { ok: true };
  }
}
