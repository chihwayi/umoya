import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { BillingService } from '../services/billing.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

// A-004/MOAS-20: same class of gap as the finance.controller.ts fix (MOAS-04)
// — this controller had JwtAuthGuard (any logged-in user) but no @Roles(),
// so any staff role (pharmacist, lab_tech, radiologist, receptionist...)
// could create bills, list every patient's billing history, and post
// payments. Scoped to the same accounts/nurse_accounts/admin set as finance.controller.ts.
@ApiTags('Billing & Invoicing')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('bills')
  @ApiOperation({ summary: 'Create bill' })
  @Roles('accounts', 'nurse_accounts', 'admin')
  async createBill(@Body() createDto: any, @Request() req: RequestWithTenant) {
    return this.billingService.createBill(createDto, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id);
  }

  @Get('bills')
  @ApiOperation({ summary: 'Get bills' })
  @Roles('accounts', 'nurse_accounts', 'admin')
  async getBills(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.billingService.findAllBills(query, req.tenantDb);
  }

  @Post('bills/:id/payments')
  @ApiOperation({ summary: 'Add payment to bill' })
  @Roles('accounts', 'nurse_accounts', 'admin')
  async addPayment(@Param('id') id: string, @Body() paymentDto: any, @Request() req: RequestWithTenant) {
    return this.billingService.addPayment(id, paymentDto, req.tenantDb, (req.user as any)?.userId ?? (req.user as any)?.id);
  }
}