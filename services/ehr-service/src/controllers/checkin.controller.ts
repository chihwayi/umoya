import { Controller, Post, Get, Body, Req, Query } from '@nestjs/common';
import { CheckinService } from '../services/checkin.service';

@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  @Post('token')
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
  async scanToken(
    @Req() req: any,
    @Body() body: { token: string },
  ) {
    return this.checkin.redeemCheckinToken(req.tenantDb, body.token, req.user.id);
  }

  @Get('queue')
  async getQueue(@Req() req: any, @Query('providerId') providerId?: string) {
    return this.checkin.getTodaysQueue(req.tenantDb, providerId);
  }
}
