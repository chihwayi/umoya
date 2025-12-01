import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { FinancialReportsService } from '../services/financial-reports.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Financial Reports')
@Controller('financial-reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FinancialReportsController {
  constructor(private readonly financialReportsService: FinancialReportsService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue report with breakdowns and trends' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  @ApiQuery({ name: 'serviceType', required: false, description: 'Filter by service type' })
  @ApiQuery({ name: 'doctorId', required: false, description: 'Filter by doctor ID' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month', 'year', 'service', 'doctor'] })
  @ApiResponse({ status: 200, description: 'Revenue report data' })
  async getRevenueReport(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    @Query('serviceType') serviceType?: string,
    @Query('doctorId') doctorId?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month' | 'year' | 'service' | 'doctor',
  ) {
    return this.financialReportsService.getRevenueReport(req.tenantDb, {
      startDate,
      endDate,
      period,
      serviceType,
      doctorId,
      groupBy,
    });
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Get Profit & Loss (P&L) statement' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'includeExpenses', required: false, type: Boolean, description: 'Include expenses in calculation' })
  @ApiResponse({ status: 200, description: 'P&L statement data' })
  async getProfitLossStatement(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('includeExpenses') includeExpenses?: boolean,
  ) {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    return this.financialReportsService.getProfitLossStatement(req.tenantDb, {
      startDate,
      endDate,
      includeExpenses: includeExpenses !== undefined ? includeExpenses : true,
    });
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Get cash flow report' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'includeProjected', required: false, type: Boolean, description: 'Include projected cash flow' })
  @ApiResponse({ status: 200, description: 'Cash flow report data' })
  async getCashFlowReport(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('includeProjected') includeProjected?: boolean,
  ) {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    return this.financialReportsService.getCashFlowReport(req.tenantDb, {
      startDate,
      endDate,
      includeProjected: includeProjected !== undefined ? includeProjected : false,
    });
  }

  @Get('aging')
  @ApiOperation({ summary: 'Get accounts receivable aging report' })
  @ApiQuery({ name: 'asOfDate', required: false, description: 'As of date (YYYY-MM-DD), defaults to today' })
  @ApiQuery({ name: 'patientId', required: false, description: 'Filter by patient ID' })
  @ApiResponse({ status: 200, description: 'Aging report data' })
  async getAgingReport(
    @Request() req: RequestWithTenant,
    @Query('asOfDate') asOfDate?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.financialReportsService.getAgingReport(req.tenantDb, {
      asOfDate,
      patientId,
    });
  }
}



