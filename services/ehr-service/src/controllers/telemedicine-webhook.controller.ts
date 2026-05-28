import {
  Controller, Post, Body, Headers, UnauthorizedException,
  HttpCode, Logger, Req, UseGuards, Get, Param, Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TelemedicinePostcallService, DailyWebhookPayload } from '../services/telemedicine-postcall.service';

@Controller('telemedicine')
export class TelemedicineWebhookController {
  private readonly logger = new Logger(TelemedicineWebhookController.name);

  constructor(private readonly postcallService: TelemedicinePostcallService) {}

  @Post('webhook/daily')
  @HttpCode(200)
  async dailyWebhook(
    @Body() payload: DailyWebhookPayload,
    @Headers('x-daily-webhook-secret') secret: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    const expectedSecret = process.env.DAILY_WEBHOOK_SECRET ?? '';
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (payload.event !== 'meeting.ended') {
      return { ok: true };
    }

    const db = req.tenantDb;
    const subdomain = req.tenantSubdomain ?? '';

    this.logger.log(`Daily.co meeting.ended received: ${payload.id}`);
    await this.postcallService.handleCallEnded(payload, db, subdomain);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('postcall-events/:patientId')
  async getEvents(
    @Param('patientId') patientId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.postcallService.getPostcallEvents(patientId, req.tenantDb);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('postcall-events/:eventId/retry')
  async retryEvent(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.postcallService.retryFailed(
      eventId,
      req.tenantDb,
      req.tenantSubdomain ?? '',
    );
    return { ok: true };
  }
}
