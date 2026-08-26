import { Controller, Post, Get, Body, Req, Query, UseGuards } from '@nestjs/common';
import { CheckinService } from '../services/checkin.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';

@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  @Post('token')
  @UseGuards(PatientJwtAuthGuard)
  async generateToken(
    @Req() req: any,
    @Body() body: { appointmentId?: string },
  ) {
    return this.checkin.generateCheckinToken(
      req.tenantDb,
      req.patientId,
      body.appointmentId,
    );
  }

  @Post('scan')
  @UseGuards(JwtAuthGuard)
  async scanToken(
    @Req() req: any,
    @Body() body: { token: string },
  ) {
    return this.checkin.redeemCheckinToken(req.tenantDb, body.token, req.user.id);
  }

  @Get('queue')
  @UseGuards(JwtAuthGuard)
  async getQueue(@Req() req: any, @Query('providerId') providerId?: string) {
    return this.checkin.getTodaysQueue(req.tenantDb, providerId);
  }
}
