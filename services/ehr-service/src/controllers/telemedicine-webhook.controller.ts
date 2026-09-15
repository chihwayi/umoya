import {
  Controller, Post, Body, Headers, UnauthorizedException,
  HttpCode, Logger, Req, UseGuards, Get, Param, Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TelemedicinePostcallService, DailyWebhookPayload } from '../services/telemedicine-postcall.service';
import { TenantService } from '../services/tenant.service';

@Controller('telemedicine')
export class TelemedicineWebhookController {
  private readonly logger = new Logger(TelemedicineWebhookController.name);

  constructor(
    private readonly postcallService: TelemedicinePostcallService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('webhook/daily')
  @HttpCode(200)
  async dailyWebhook(
    @Body() payload: DailyWebhookPayload,
    @Headers('x-daily-webhook-secret') secret: string,
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    const expectedSecret = process.env.DAILY_WEBHOOK_SECRET ?? '';
    if (!expectedSecret) {
      throw new UnauthorizedException('Daily.co webhook is not configured');
    }
    if (secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (payload.event !== 'meeting.ended') {
      return { ok: true };
    }

    // Daily.co has no way to send X-Tenant-Id, so this path is excluded from
    // tenant.middleware.ts (req.tenantDb is never set here) — resolve via
    // SINGLE_TENANT_ID, same fallback used by the mobile-money webhooks.
    const tenantId = req.tenantId ?? process.env.SINGLE_TENANT_ID ?? '';
    if (!tenantId) {
      this.logger.warn('Daily.co webhook received but no tenant could be resolved (SINGLE_TENANT_ID unset)');
      return { ok: true };
    }
    const db = req.tenantDb ?? (await this.tenantService.getTenantDatabase(tenantId));
    const subdomain = req.tenantSubdomain ?? tenantId;

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
