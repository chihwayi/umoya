import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { PaymentsService } from '../services/payments.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { Public } from '../decorators/public.decorator';

@ApiTags('Mobile Money Payments (Zimbabwe)')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('mobile-money')
  @ApiOperation({ summary: 'Process mobile money payment (EcoCash/OneMoney)' })
  @ApiResponse({ status: 201, description: 'Payment initiated successfully' })
  async processMobileMoneyPayment(@Body() paymentData: any, @Request() req: RequestWithTenant) {
    return this.paymentsService.processMobileMoneyPayment(paymentData, req.tenantDb);
  }

  @Post('ecocash')
  @ApiOperation({ summary: 'Process EcoCash payment' })
  @ApiResponse({ status: 201, description: 'EcoCash payment initiated' })
  async processEcoCashPayment(@Body() paymentData: any, @Request() req: RequestWithTenant) {
    return this.paymentsService.processEcoCashPayment(paymentData, req.tenantDb);
  }

  @Post('onemoney')
  @ApiOperation({ summary: 'Process OneMoney payment' })
  @ApiResponse({ status: 201, description: 'OneMoney payment initiated' })
  async processOneMoneyPayment(@Body() paymentData: any, @Request() req: RequestWithTenant) {
    return this.paymentsService.processOneMoneyPayment(paymentData, req.tenantDb);
  }

  @Get('status/:transactionId')
  @ApiOperation({ summary: 'Check payment status' })
  @ApiResponse({ status: 200, description: 'Payment status retrieved' })
  async getPaymentStatus(@Param('transactionId') transactionId: string, @Request() req: RequestWithTenant) {
    return this.paymentsService.getPaymentStatus(transactionId, req.tenantDb);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify mobile money payment' })
  @ApiResponse({ status: 200, description: 'Payment verified' })
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
