import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { PaymentsService } from '../services/payments.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { Public } from '../decorators/public.decorator';

// A-004/MOAS-20: payment initiation/verification/status routes restricted to
// the roles that actually take patient payments at point of care
// (accounts/nurse_accounts back office, receptionist front desk).
// `provider-callback` stays @Public() (external webhook, no staff session)
// and `methods` stays open to any staff role (non-sensitive, no PHI/financial
// data — just the list of supported payment methods).
@ApiTags('Mobile Money Payments (Zimbabwe)')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('mobile-money')
  @ApiOperation({ summary: 'Process mobile money payment (EcoCash/OneMoney)' })
  @ApiResponse({ status: 201, description: 'Payment initiated successfully' })
  @Roles('accounts', 'nurse_accounts', 'receptionist')
  async processMobileMoneyPayment(@Body() paymentData: any, @Request() req: RequestWithTenant) {
    return this.paymentsService.processMobileMoneyPayment(paymentData, req.tenantDb);
  }

  @Post('ecocash')
  @ApiOperation({ summary: 'Process EcoCash payment' })
  @ApiResponse({ status: 201, description: 'EcoCash payment initiated' })
  @Roles('accounts', 'nurse_accounts', 'receptionist')
  async processEcoCashPayment(@Body() paymentData: any, @Request() req: RequestWithTenant) {
    return this.paymentsService.processEcoCashPayment(paymentData, req.tenantDb);
  }

  @Post('onemoney')
  @ApiOperation({ summary: 'Process OneMoney payment' })
  @ApiResponse({ status: 201, description: 'OneMoney payment initiated' })
  @Roles('accounts', 'nurse_accounts', 'receptionist')
  async processOneMoneyPayment(@Body() paymentData: any, @Request() req: RequestWithTenant) {
    return this.paymentsService.processOneMoneyPayment(paymentData, req.tenantDb);
  }

  @Get('status/:transactionId')
  @ApiOperation({ summary: 'Check payment status' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  @Roles('accounts', 'nurse_accounts', 'receptionist')
  async getPaymentStatus(@Param('transactionId') transactionId: string, @Request() req: RequestWithTenant) {
    return this.paymentsService.getPaymentStatus(transactionId, req.tenantDb);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify mobile money payment' })
  @ApiResponse({ status: 200, description: 'Payment verified' })
  @Roles('accounts', 'nurse_accounts', 'receptionist')
  async verifyPayment(@Body() data: { transactionId: string, reference: string }, @Request() req: RequestWithTenant) {
    return this.paymentsService.verifyPayment(data.transactionId, data.reference, req.tenantDb);
  }

  @Public()
  @Post('provider-callback')
  @ApiOperation({ summary: 'Record a provider callback/payment event' })
  @ApiResponse({ status: 200, description: 'Provider callback processed' })
  async recordProviderCallback(@Body() data: any, @Request() req: RequestWithTenant) {
    return this.paymentsService.recordProviderCallback(data, req.tenantDb);
  }

  @Get('methods')
  @ApiOperation({ summary: 'Get available payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods retrieved' })
  async getPaymentMethods(@Request() req: RequestWithTenant) {
    return this.paymentsService.getPaymentMethods();
  }
}
