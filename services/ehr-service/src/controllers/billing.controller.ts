import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { BillingService } from '../services/billing.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Billing & Invoicing')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('bills')
  @ApiOperation({ summary: 'Create bill' })
  async createBill(@Body() createDto: any, @Request() req: RequestWithTenant) {
    return this.billingService.createBill(createDto, req.tenantDb, (req.user as any).id);
  }

  @Get('bills')
  @ApiOperation({ summary: 'Get bills' })
  async getBills(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.billingService.findAllBills(query, req.tenantDb);
  }

  @Post('bills/:id/payments')
  @ApiOperation({ summary: 'Add payment to bill' })
  async addPayment(@Param('id') id: string, @Body() paymentDto: any, @Request() req: RequestWithTenant) {
    return this.billingService.addPayment(id, paymentDto, req.tenantDb, (req.user as any).id);
  }
}