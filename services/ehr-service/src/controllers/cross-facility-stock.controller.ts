import { UseGuards, Controller, Get, Post, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { CrossFacilityStockService } from '../services/cross-facility-stock.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('network/stock')
@UseGuards(JwtAuthGuard)
export class CrossFacilityStockController {
  constructor(private readonly stock: CrossFacilityStockService) {}

  @Get('levels')
  getNetworkLevels() {
    return this.stock.getNetworkStockLevels();
  }

  @Get('recommendations')
  getRecommendations() {
    return this.stock.getRebalanceRecommendations();
  }

  @Post('transfer-orders')
  raiseOrder(
    @Req() req: any,
    @Body() body: {
      itemId: string;
      quantity: number;
      fromFacility: string;
      toFacility: string;
      notes?: string;
    },
  ) {
    return this.stock.raiseTransferOrder(
      req.tenantDb, body.itemId, body.quantity,
      body.fromFacility, body.toFacility, req.user.id, body.notes,
    );
  }

  @Get('transfer-orders')
  listOrders(@Req() req: any, @Query('status') status?: string) {
    return this.stock.listTransferOrders(req.tenantDb, status);
  }

  @Patch('transfer-orders/:id/status')
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'dispatched' | 'received' | 'cancelled' },
  ) {
    return this.stock.updateTransferStatus(req.tenantDb, id, body.status, req.user.id);
  }
}
