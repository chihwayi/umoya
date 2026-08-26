import { UseGuards, Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { SupplyChainAiService } from '../services/supply-chain-ai.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('supply-chain')
@UseGuards(JwtAuthGuard)
export class SupplyChainAiController {
  constructor(private readonly svc: SupplyChainAiService) {}

  @Post('predict')
  predict(
    @Body('subdomain') subdomain: string,
    @Body('drugName') drugName?: string,
  ) {
    return this.svc.predictStockouts(subdomain, drugName);
  }

  @Get('predictions')
  getPredictions(@Query('subdomain') subdomain: string) {
    return this.svc.getPredictions(subdomain);
  }

  @Get('procurement-alerts')
  getProcurementAlerts(@Query('subdomain') subdomain: string) {
    return this.svc.getProcurementAlerts(subdomain);
  }

  @Patch('procurement-alerts/:id/acknowledge')
  acknowledgeAlert(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body('userId') userId: string,
    @Body('orderReference') orderReference?: string,
  ) {
    return this.svc.acknowledgeProcurementAlert(subdomain, id, userId, orderReference);
  }
}
