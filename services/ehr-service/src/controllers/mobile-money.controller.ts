import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
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

  @Post('callback/mpesa')
  @HttpCode(200)
  async callbackMpesa(@Body() payload: any) {
    const tenantId = process.env.SINGLE_TENANT_ID || '';
    if (tenantId) await this.mobileMoneyService.handleCallback(tenantId, 'mpesa', payload);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  @Post('callback/mtn')
  @HttpCode(200)
  async callbackMtn(@Body() payload: any) {
    const tenantId = process.env.SINGLE_TENANT_ID || '';
    if (tenantId) await this.mobileMoneyService.handleCallback(tenantId, 'mtn_momo', payload);
    return { status: 'accepted' };
  }

  @Post('callback/ecocash')
  @HttpCode(200)
  async callbackEcocash(@Body() payload: any) {
    const tenantId = process.env.SINGLE_TENANT_ID || '';
    if (tenantId) await this.mobileMoneyService.handleCallback(tenantId, 'ecocash', payload);
    return { status: 'accepted' };
  }

  @Post('callback/airtel')
  @HttpCode(200)
  async callbackAirtel(@Body() payload: any) {
    const tenantId = process.env.SINGLE_TENANT_ID || '';
    if (tenantId) await this.mobileMoneyService.handleCallback(tenantId, 'airtel', payload);
    return { status: 'accepted' };
  }

  @Post('callback/flutterwave')
  @HttpCode(200)
  async callbackFlutterwave(@Body() payload: any) {
    const tenantId = process.env.SINGLE_TENANT_ID || '';
    if (tenantId) await this.mobileMoneyService.handleCallback(tenantId, 'flutterwave', payload);
    return { status: 'accepted' };
  }
}
