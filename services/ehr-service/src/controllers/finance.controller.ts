import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { FinanceService } from '../services/finance.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import {
  CreateFinanceTransactionDto,
  CreateInvoiceTemplateDto,
  RecordPaymentDto,
  UpdateInvoiceTemplateDto,
} from '../dto/finance.dto';
import { InvoicePdfService } from '../services/invoice-pdf.service';
import { InvoiceTemplateService } from '../services/invoice-template.service';

@ApiTags('Finance')
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly invoiceTemplateService: InvoiceTemplateService,
  ) {}

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get finance dashboard summary' })
  @ApiResponse({ status: 200 })
  async getSummary(@Request() req: RequestWithTenant) {
    return this.financeService.getDashboardSummary(req.tenantDb);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List financial transactions with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'payerType', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listTransactions(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('module') module?: string,
    @Query('payerType') payerType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.financeService.listTransactions(req.tenantDb, {
      status,
      module,
      payerType,
      dateFrom,
      dateTo,
      search,
      limit,
      offset,
    });
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get a transaction detail' })
  async getTransactionDetail(@Request() req: RequestWithTenant, @Param('id') id: string) {
    return this.financeService.getTransactionDetail(req.tenantDb, id);
  }

  @Get('transactions/:id/status')
  @ApiOperation({ summary: 'Get payment status for a transaction' })
  async getTransactionStatus(@Request() req: RequestWithTenant, @Param('id') id: string) {
    return this.financeService.getTransactionStatus(req.tenantDb, id);
  }

  @Get('transactions/:id/invoice.pdf')
  @ApiOperation({ summary: 'Download invoice PDF for a transaction' })
  async downloadInvoicePdf(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Query('templateId') templateId: string | undefined,
    @Res() res: Response,
  ) {
    const detail = await this.financeService.getTransactionDetail(req.tenantDb, id);
    const { buffer, fileName } = await this.invoicePdfService.generateFinanceTransactionInvoice(
      req.tenantDb,
      detail,
      templateId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Create a finance transaction for a clinical service' })
  @Roles('accounts', 'nurse_accounts')
  async createTransaction(
    @Request() req: RequestWithTenant,
    @Body() payload: CreateFinanceTransactionDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.financeService.createTransaction(req.tenantDb, payload, userId);
  }

  @Post('transactions/:id/payments')
  @ApiOperation({ summary: 'Record a payment for a transaction' })
  @Roles('accounts', 'nurse_accounts')
  async recordPayment(
    @Request() req: RequestWithTenant,
    @Param('id') transactionId: string,
    @Body() payload: RecordPaymentDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.financeService.recordPayment(req.tenantDb, transactionId, payload, userId);
  }

  @Get('invoice-templates')
  @ApiOperation({ summary: 'List invoice templates' })
  async listInvoiceTemplates(@Request() req: RequestWithTenant) {
    return this.invoiceTemplateService.listTemplates(req.tenantDb);
  }

  @Post('invoice-templates')
  @ApiOperation({ summary: 'Create an invoice template' })
  async createInvoiceTemplate(
    @Request() req: RequestWithTenant,
    @Body() payload: CreateInvoiceTemplateDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.invoiceTemplateService.createTemplate(req.tenantDb, payload, userId);
  }

  @Put('invoice-templates/:id')
  @ApiOperation({ summary: 'Update an invoice template' })
  async updateInvoiceTemplate(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() payload: UpdateInvoiceTemplateDto,
  ) {
    return this.invoiceTemplateService.updateTemplate(req.tenantDb, id, payload);
  }

  @Post('invoice-templates/:id/default')
  @ApiOperation({ summary: 'Mark template as default' })
  async setDefaultInvoiceTemplate(@Request() req: RequestWithTenant, @Param('id') id: string) {
    return this.invoiceTemplateService.setDefaultTemplate(req.tenantDb, id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get financial reports' })
  @ApiQuery({ name: 'reportType', required: true, enum: ['revenue', 'profit_loss', 'cash_flow', 'aging'] })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getFinancialReports(
    @Request() req: RequestWithTenant,
    @Query('reportType') reportType: 'revenue' | 'profit_loss' | 'cash_flow' | 'aging',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month' | 'year',
  ) {
    return this.financeService.getFinancialReports(req.tenantDb, {
      reportType,
      dateFrom,
      dateTo,
      groupBy,
    });
  }

  @Get('tax/summary')
  @ApiOperation({ summary: 'Get tax summary' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getTaxSummary(
    @Request() req: RequestWithTenant,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.financeService.getTaxSummary(req.tenantDb, dateFrom, dateTo);
  }

  @Post('tax/calculate')
  @ApiOperation({ summary: 'Calculate tax for an amount' })
  async calculateTax(
    @Body() body: { amount: number; taxRate?: number },
  ) {
    return this.financeService.calculateTax(body.amount, body.taxRate);
  }

  @Post('reconciliation')
  @ApiOperation({ summary: 'Reconcile a payment' })
  async reconcilePayment(
    @Request() req: RequestWithTenant,
    @Body() reconciliationData: {
      transactionId: string;
      reconciliationDate: string;
      reconciledAmount: number;
      bankReference?: string;
      notes?: string;
    },
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.financeService.reconcilePayments(req.tenantDb, reconciliationData, userId);
  }

  @Get('reconciliation')
  @ApiOperation({ summary: 'Get reconciliation report' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async getReconciliationReport(
    @Request() req: RequestWithTenant,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.financeService.getReconciliationReport(req.tenantDb, dateFrom, dateTo);
  }
}
