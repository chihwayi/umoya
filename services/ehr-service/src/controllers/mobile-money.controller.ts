import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MobileMoneyService } from '../services/mobile-money.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('payments/mobile-money')
export class MobileMoneyController {
  constructor(private readonly mobileMoneyService: MobileMoneyService) {}

  // ── Authenticated endpoints ───────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('configs')
  async getConfigs(@Request() req: RequestWithTenant) {
    return this.mobileMoneyService.getConfigs(req.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiate(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.mobileMoneyService.initiate(req.tenantId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':transactionId')
  async getTransaction(@Param('transactionId') id: string, @Request() req: RequestWithTenant) {
    return this.mobileMoneyService.getTransaction(req.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invoice/:invoiceId')
  async getByInvoice(@Param('invoiceId') invoiceId: string, @Request() req: RequestWithTenant) {
    return this.mobileMoneyService.getByInvoice(req.tenantId, invoiceId);
  }

  // ── Provider webhooks (no JWT — providers call these directly) ────────────
  // Tenant ID is extracted from the callback URL path injected at config time.
  // Fallback: single-tenant deployments set SINGLE_TENANT_ID env var.
  //
  // FX-019: every callback is verified before anything is credited (signature
  // or OAuth query-back per provider); unverified providers stay disabled.
  // An unresolvable tenant now fails closed instead of returning a fake
  // "Accepted" while doing nothing.

  private resolveTenantId(): string {
    const tenantId = process.env.SINGLE_TENANT_ID || '';
    if (!tenantId) {
      throw new ForbiddenException('Callback tenant is not configured — failing closed');
    }
    return tenantId;
  }

  @Post('callback/mpesa')
  @HttpCode(200)
  async callbackMpesa(@Body() payload: any, @Headers() headers: Record<string, any>) {
    await this.mobileMoneyService.handleCallback(this.resolveTenantId(), 'mpesa', payload, { headers });
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  @Post('callback/mtn')
  @HttpCode(200)
  async callbackMtn(@Body() payload: any, @Headers() headers: Record<string, any>) {
    await this.mobileMoneyService.handleCallback(this.resolveTenantId(), 'mtn_momo', payload, { headers });
    return { status: 'accepted' };
  }

  @Post('callback/ecocash')
  @HttpCode(200)
  async callbackEcocash(@Body() payload: any, @Headers() headers: Record<string, any>) {
    await this.mobileMoneyService.handleCallback(this.resolveTenantId(), 'ecocash', payload, { headers });
    return { status: 'accepted' };
  }

  @Post('callback/airtel')
  @HttpCode(200)
  async callbackAirtel(@Body() payload: any, @Headers() headers: Record<string, any>) {
    await this.mobileMoneyService.handleCallback(this.resolveTenantId(), 'airtel', payload, { headers });
    return { status: 'accepted' };
  }

  @Post('callback/flutterwave')
  @HttpCode(200)
  async callbackFlutterwave(@Body() payload: any, @Headers() headers: Record<string, any>) {
    await this.mobileMoneyService.handleCallback(this.resolveTenantId(), 'flutterwave', payload, { headers });
    return { status: 'accepted' };
  }
}
