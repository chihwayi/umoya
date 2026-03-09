import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TenantService } from '../services/tenant.service';
import { CurrencyExchangeService } from '../services/currency-exchange.service';

@ApiTags('Currency & Exchange')
@ApiBearerAuth()
@Controller('currency')
@UseGuards(JwtAuthGuard)
export class CurrencyExchangeController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly currencyExchangeService: CurrencyExchangeService,
  ) {}

  @Get('currencies')
  @ApiOperation({ summary: 'List supported currencies' })
  async listCurrencies(@Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.currencyExchangeService.listCurrencies(tenantDb);
  }

  @Post('currencies')
  @ApiOperation({ summary: 'Upsert a supported currency' })
  async upsertCurrency(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.currencyExchangeService.upsertCurrency(tenantDb, body);
  }

  @Get('exchange-rates')
  @ApiOperation({ summary: 'List exchange rates (latest first)' })
  async listRates(
    @Query('baseCurrency') baseCurrency: string | undefined,
    @Query('quoteCurrency') quoteCurrency: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.currencyExchangeService.listExchangeRates(tenantDb, {
      baseCurrency,
      quoteCurrency,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('exchange-rates')
  @ApiOperation({ summary: 'Create a new exchange rate' })
  async createRate(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return await this.currencyExchangeService.createExchangeRate(tenantDb, userId, body);
  }
}

