import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { FollowUpRecommendationService } from '../services/followup-recommendation.service';

@UseGuards(JwtAuthGuard)
@Controller('followup')
export class FollowUpController {
  constructor(private readonly svc: FollowUpRecommendationService) {}

  @Post('recommend')
  async recommend(
    @Req() req: any,
    @Body() body: {
      patientId: number;
      encounterId?: number;
      encounterType: 'consultation' | 'telemedicine' | 'discharge';
      riskBand: 'low' | 'moderate' | 'high' | 'critical';
      diagnoses: string[];
      openCareGapsCount: number;
      medicationsChanged: boolean;
    },
  ) {
    return this.svc.generateRecommendation(req.tenantDb, {
      ...body,
      subdomain: req.tenantSubdomain,
    });
  }

  @Patch(':id/accept')
  async accept(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { overrideDays?: number; overrideModality?: string },
  ) {
    await this.svc.acceptRecommendation(
      req.tenantDb,
      parseInt(id),
      req.user.sub,
      body.overrideDays || body.overrideModality
        ? { days: body.overrideDays, modality: body.overrideModality }
        : undefined,
    );
    return { ok: true };
  }

  @Patch(':id/dismiss')
  async dismiss(@Req() req: any, @Param('id') id: string) {
    await this.svc.dismissRecommendation(req.tenantDb, parseInt(id), req.user.sub);
    return { ok: true };
  }

  @Patch(':id/booked')
  async markBooked(@Req() req: any, @Param('id') id: string) {
    await this.svc.markAppointmentBooked(req.tenantDb, parseInt(id));
    return { ok: true };
  }

  @Get('patient/:patientId')
  async patientHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientRecommendations(req.tenantDb, parseInt(patientId));
  }

  @Get('overdue')
  async overdue(@Req() req: any) {
    return this.svc.getOverdueFollowUps(req.tenantDb);
  }
}
