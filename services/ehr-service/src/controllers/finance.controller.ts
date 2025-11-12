import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { FinanceService } from '../services/finance.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CreateFinanceTransactionDto, RecordPaymentDto } from '../dto/finance.dto';

@ApiTags('Finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

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

  @Post('transactions')
  @ApiOperation({ summary: 'Create a finance transaction for a clinical service' })
  async createTransaction(
    @Request() req: RequestWithTenant,
    @Body() payload: CreateFinanceTransactionDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.financeService.createTransaction(req.tenantDb, payload, userId);
  }

  @Post('transactions/:id/payments')
  @ApiOperation({ summary: 'Record a payment for a transaction' })
  async recordPayment(
    @Request() req: RequestWithTenant,
    @Param('id') transactionId: string,
    @Body() payload: RecordPaymentDto,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.financeService.recordPayment(req.tenantDb, transactionId, payload, userId);
  }
}

