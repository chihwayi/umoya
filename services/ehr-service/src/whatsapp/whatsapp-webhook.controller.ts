import { Controller, ForbiddenException, Get, HttpCode, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantService } from '../services/tenant.service';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { AtMessageLog } from '../entities/at-message-log.entity';

/**
 * Public routes — no JwtAuthGuard, Meta calls these directly. Tenant is
 * resolved from `:tenantSlug` in the URL, NOT from X-Tenant-ID (Meta cannot
 * send that header) and NOT via TenantMiddleware (excluded in
 * tenant.middleware.ts's isPublicTenantEndpoint allowlist — same reasoning
 * as the existing mobile-money/Daily.co webhook bypasses in this file).
 *
 * Every real-production tenant gets its own webhook URL
 * (`/api/webhooks/whatsapp/meta/<tenantSlug>`), entered once into that
 * tenant's Meta Business dashboard — this is how a single shared ehr-service
 * instance resolves which tenant's isolated database an inbound message
 * belongs to, before any X-Tenant-ID-based mechanism could apply.
 */
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly whatsappService: WhatsappMessagingService,
  ) {}

  @Get('meta/:tenantSlug')
  async verify(@Param('tenantSlug') tenantSlug: string, @Query() query: Record<string, string>) {
    const adapter = await this.whatsappService.getAdapterForTenant(tenantSlug);
    if (!adapter) throw new ForbiddenException('WhatsApp channel not configured for this tenant');
    const challenge = adapter.verifyHandshake(query);
    if (challenge === null) throw new ForbiddenException();
    return challenge;
  }

  @Post('meta/:tenantSlug')
  @HttpCode(200)
  async receive(@Param('tenantSlug') tenantSlug: string, @Req() req: Request & { rawBody?: Buffer }) {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantSlug);
    if (!tenantDb) {
      // Ack so Meta doesn't retry forever on a genuinely unknown/misconfigured tenant slug.
      this.logger.warn(`WhatsApp webhook for unknown tenant slug: ${tenantSlug}`);
      return 'EVENT_RECEIVED';
    }
    const adapter = await this.whatsappService.getAdapterForTenant(tenantSlug);
    if (!adapter) {
      this.logger.warn(`WhatsApp webhook for tenant with no active channel config: ${tenantSlug}`);
      return 'EVENT_RECEIVED';
    }

    await this.whatsappService.handleInboundWebhook(tenantDb, adapter, {
      headers: req.headers as Record<string, unknown>,
      rawBody: req.rawBody,
      body: req.body,
    });
    return 'EVENT_RECEIVED';
  }

  // ── Patient consent (authenticated, normal tenant-scoped routes) ─────────

  @UseGuards(JwtAuthGuard)
  @Get('consent/:patientId')
  async getConsent(@Req() req: any, @Param('patientId') patientId: string) {
    const consent = await this.whatsappService.getConsent(req.tenantDb, patientId);
    return consent ?? { patientId, optedIn: false };
  }

  @UseGuards(JwtAuthGuard)
  @Post('consent/:patientId')
  async setConsent(@Req() req: any, @Param('patientId') patientId: string) {
    const { phoneNumber, optedIn } = req.body as { phoneNumber: string; optedIn: boolean };
    return this.whatsappService.setConsent(req.tenantDb, patientId, phoneNumber, !!optedIn);
  }

  @UseGuards(JwtAuthGuard)
  @Get('thread/:patientId')
  async getThread(@Req() req: any, @Param('patientId') patientId: string) {
    const repo = req.tenantDb.getRepository(AtMessageLog);
    return repo.find({
      where: { patientId, channel: 'whatsapp' },
      order: { sentAt: 'ASC' },
      take: 200,
    });
  }
}
