import { UseGuards, Controller, Post, Get, Patch, Body, Param, Req } from '@nestjs/common';
import { SupplyChainAiService } from '../services/supply-chain-ai.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('supply-chain')
@UseGuards(JwtAuthGuard)
export class SupplyChainAiController {
  constructor(private readonly svc: SupplyChainAiService) {}

  @Post('predict')
  predict(
    @Req() req: RequestWithTenant,
    @Body('drugName') drugName?: string,
  ) {
    return this.svc.predictStockouts(req.tenantDb!, drugName);
  }

  @Get('predictions')
  getPredictions(@Req() req: RequestWithTenant) {
    return this.svc.getPredictions(req.tenantDb!);
  }

  @Get('procurement-alerts')
  getProcurementAlerts(@Req() req: RequestWithTenant) {
    return this.svc.getProcurementAlerts(req.tenantDb!);
  }

  @Patch('procurement-alerts/:id/acknowledge')
  acknowledgeAlert(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('orderReference') orderReference?: string,
  ) {
    return this.svc.acknowledgeProcurementAlert(req.tenantDb!, id, userId, orderReference);
  }
}
