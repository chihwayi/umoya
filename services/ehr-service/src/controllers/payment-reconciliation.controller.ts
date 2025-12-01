import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PaymentReconciliationService, BankStatementEntry, ReconciliationFilters } from '../services/payment-reconciliation.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Payment Reconciliation')
@Controller('payment-reconciliation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentReconciliationController {
  constructor(private readonly paymentReconciliationService: PaymentReconciliationService) {}

  @Post('bank-statement/import')
  @ApiOperation({ summary: 'Import bank statement entries' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 201, description: 'Bank statement imported and auto-matched' })
  async importBankStatement(
    @Request() req: RequestWithTenant,
    @Body() body: { entries: BankStatementEntry[]; statementDate: string },
  ) {
    return this.paymentReconciliationService.importBankStatement(
      req.tenantDb,
      body.entries,
      new Date(body.statementDate),
    );
  }

  @Post('auto-match')
  @ApiOperation({ summary: 'Auto-match payments with bank statement entries' })
  @ApiBody({ type: Object, required: false })
  @ApiResponse({ status: 200, description: 'Auto-matching results' })
  async autoMatchPayments(
    @Request() req: RequestWithTenant,
    @Body() body?: { bankEntryIds?: string[] },
  ) {
    return this.paymentReconciliationService.autoMatchPayments(
      req.tenantDb,
      body?.bankEntryIds,
    );
  }

  @Post('match')
  @ApiOperation({ summary: 'Manually match a payment with a bank statement entry' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 200, description: 'Payment matched successfully' })
  async matchPayment(
    @Request() req: RequestWithTenant,
    @Body() body: { bankEntryId: string; paymentId: string },
  ) {
    return this.paymentReconciliationService.matchPayment(
      req.tenantDb,
      body.bankEntryId,
      body.paymentId,
      req.user?.id || 'system',
    );
  }

  @Get('unmatched-payments')
  @ApiOperation({ summary: 'Get unmatched payments' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'paymentMethod', required: false })
  @ApiResponse({ status: 200, description: 'Unmatched payments list' })
  async getUnmatchedPayments(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.paymentReconciliationService.getUnmatchedPayments(req.tenantDb, {
      startDate,
      endDate,
      paymentMethod,
    });
  }

  @Get('unmatched-bank-entries')
  @ApiOperation({ summary: 'Get unmatched bank statement entries' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Unmatched bank entries list' })
  async getUnmatchedBankEntries(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentReconciliationService.getUnmatchedBankEntries(req.tenantDb, {
      startDate,
      endDate,
    });
  }

  @Get('report')
  @ApiOperation({ summary: 'Get reconciliation report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'status', required: false, enum: ['matched', 'unmatched', 'all'] })
  @ApiResponse({ status: 200, description: 'Reconciliation report' })
  async getReconciliationReport(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('status') status?: 'matched' | 'unmatched' | 'all',
  ) {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    return this.paymentReconciliationService.getReconciliationReport(req.tenantDb, {
      startDate,
      endDate,
      status,
    });
  }
}



