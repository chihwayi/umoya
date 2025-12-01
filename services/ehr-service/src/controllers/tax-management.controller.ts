import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TaxManagementService, TaxConfiguration, VATCalculationInput, PAYECalculationInput } from '../services/tax-management.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Tax Management')
@Controller('tax')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaxManagementController {
  constructor(private readonly taxManagementService: TaxManagementService) {}

  @Get('configuration')
  @ApiOperation({ summary: 'Get tax configuration' })
  @ApiQuery({ name: 'taxType', required: true, enum: ['VAT', 'PAYE', 'CUSTOM'] })
  @ApiResponse({ status: 200, description: 'Tax configuration' })
  async getTaxConfiguration(
    @Request() req: RequestWithTenant,
    @Query('taxType') taxType: 'VAT' | 'PAYE' | 'CUSTOM',
  ) {
    return this.taxManagementService.getTaxConfiguration(req.tenantDb, taxType);
  }

  @Post('configuration')
  @ApiOperation({ summary: 'Save tax configuration' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 201, description: 'Tax configuration saved' })
  async saveTaxConfiguration(
    @Request() req: RequestWithTenant,
    @Body() config: TaxConfiguration,
  ) {
    return this.taxManagementService.saveTaxConfiguration(req.tenantDb, config);
  }

  @Post('vat/calculate')
  @ApiOperation({ summary: 'Calculate VAT' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 200, description: 'VAT calculation result' })
  async calculateVAT(
    @Request() req: RequestWithTenant,
    @Body() input: VATCalculationInput,
  ) {
    return this.taxManagementService.calculateVAT(req.tenantDb, input);
  }

  @Post('paye/calculate')
  @ApiOperation({ summary: 'Calculate PAYE tax' })
  @ApiBody({ type: Object })
  @ApiResponse({ status: 200, description: 'PAYE calculation result' })
  async calculatePAYE(
    @Request() req: RequestWithTenant,
    @Body() input: PAYECalculationInput,
  ) {
    return this.taxManagementService.calculatePAYE(req.tenantDb, input);
  }

  @Get('vat/report')
  @ApiOperation({ summary: 'Get VAT report' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'VAT report data' })
  async getVATReport(
    @Request() req: RequestWithTenant,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    return this.taxManagementService.getVATReport(req.tenantDb, startDate, endDate);
  }

  @Get('paye/report')
  @ApiOperation({ summary: 'Get PAYE report' })
  @ApiQuery({ name: 'taxPeriod', required: true, description: 'Tax period (YYYY-MM)' })
  @ApiResponse({ status: 200, description: 'PAYE report data' })
  async getPAYEReport(
    @Request() req: RequestWithTenant,
    @Query('taxPeriod') taxPeriod: string,
  ) {
    if (!taxPeriod) {
      throw new Error('taxPeriod is required (format: YYYY-MM)');
    }

    return this.taxManagementService.getPAYEReport(req.tenantDb, taxPeriod);
  }
}



