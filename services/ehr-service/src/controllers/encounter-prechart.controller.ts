import { Controller, Get, Post, Patch, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AppointmentPrecharterService } from '../services/appointment-precharter.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('precharts')
@UseGuards(JwtAuthGuard)
export class EncounterPrechartController {
  constructor(private readonly precharterService: AppointmentPrecharterService) {}

  /** GET /precharts/appointment/:appointmentId — fetch pre-chart for an appointment */
  @Get('appointment/:appointmentId')
  async getForAppointment(
    @Param('appointmentId') appointmentId: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.precharterService.getPrechart(appointmentId, req.tenantDb);
  }

  /** POST /precharts/appointment/:appointmentId/generate — manually trigger pre-charting */
  @Post('appointment/:appointmentId/generate')
  async generateForAppointment(
    @Param('appointmentId') appointmentId: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.precharterService.generateForAppointment(appointmentId, req.tenantDb);
  }

  /** PATCH /precharts/appointment/:appointmentId/reviewed — mark provider reviewed */
  @Patch('appointment/:appointmentId/reviewed')
  async markReviewed(
    @Param('appointmentId') appointmentId: string,
    @Request() req: RequestWithTenant,
  ) {
    await this.precharterService.markReviewed(appointmentId, req.tenantDb);
    return { ok: true };
  }
}
