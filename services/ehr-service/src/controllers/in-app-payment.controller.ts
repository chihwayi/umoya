import { Controller, Get, Post, Param, Query, Body, Req } from '@nestjs/common';
import { InAppPaymentService } from '../services/in-app-payment.service';

@Controller('payments/patient')
export class InAppPaymentController {
  constructor(private readonly pay: InAppPaymentService) {}

  @Get('invoices')
  getInvoices(@Req() req: any) {
    return this.pay.getOutstandingInvoices(req.tenantDb, req.patientId ?? req.user?.id);
  }

  @Post('initiate')
  initiate(
    @Req() req: any,
    @Body() body: { invoiceId: string; method: string; mobileNumber?: string },
  ) {
    return this.pay.initiatePayment(
      req.tenantDb,
      req.patientId ?? req.user?.id,
      body.invoiceId,
      body.method,
      body.mobileNumber,
    );
  }

  @Post('transactions/:id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.pay.confirmPayment(req.tenantDb, id);
  }

  @Get('transactions/:id/status')
  getStatus(@Req() req: any, @Param('id') id: string) {
    return this.pay.getTransactionStatus(req.tenantDb, id, req.patientId ?? req.user?.id);
  }
}
