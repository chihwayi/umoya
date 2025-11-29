import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { ClaimsService } from '../services/claims.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Medical Aid Claims')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('claims')
export class ClaimsController {
  constructor(private claimsService: ClaimsService) {}

  @Post()
  @ApiOperation({ summary: 'Create medical aid claim' })
  @ApiResponse({ status: 201, description: 'Claim created successfully' })
  async createClaim(@Body() createClaimDto: any, @Request() req: RequestWithTenant) {
    return this.claimsService.createClaim(createClaimDto, req.tenantDb);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get claims analytics' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'provider', required: false })
  async getClaimAnalytics(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('provider') provider: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.getClaimAnalytics(req.tenantDb, { dateFrom, dateTo, provider });
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get claims dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved' })
  async getDashboardSummary(@Request() req: RequestWithTenant) {
    return this.claimsService.getDashboardSummary(req.tenantDb);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get claims dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved' })
  async getDashboardSummary(@Request() req: RequestWithTenant) {
    return this.claimsService.getDashboardSummary(req.tenantDb);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get claims analytics' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'provider', required: false })
  async getClaimAnalytics(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('provider') provider: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.getClaimAnalytics(req.tenantDb, { dateFrom, dateTo, provider });
  }

  @Get()
  @ApiOperation({ summary: 'Get all claims with filtering' })
  @ApiResponse({ status: 200, description: 'Claims retrieved successfully' })
  async getClaims(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.claimsService.getClaims(query, req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiResponse({ status: 200, description: 'Claim retrieved successfully' })
  async getClaimById(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.claimsService.getClaimById(id, req.tenantDb);
  }

  @Put(':id/submit')
  @ApiOperation({ summary: 'Submit claim to medical aid provider' })
  @ApiResponse({ status: 200, description: 'Claim submitted successfully' })
  async submitClaim(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.claimsService.submitClaim(id, req.tenantDb);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Check claim status with medical aid' })
  @ApiResponse({ status: 200, description: 'Claim status retrieved' })
  async checkClaimStatus(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.claimsService.checkClaimStatus(id, req.tenantDb);
  }

  @Post(':id/response')
  @ApiOperation({ summary: 'Process medical aid response' })
  @ApiResponse({ status: 200, description: 'Response processed successfully' })
  async processResponse(@Param('id') id: string, @Body() responseData: any, @Request() req: RequestWithTenant) {
    return this.claimsService.processResponse(id, responseData, req.tenantDb);
  }

  @Post('from-bill/:billId')
  @ApiOperation({ summary: 'Generate claim automatically from a bill' })
  @ApiResponse({ status: 201, description: 'Claim generated successfully' })
  async generateClaimFromBill(
    @Param('billId') billId: string,
    @Body() claimData: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.generateClaimFromBill(billId, claimData, req.tenantDb);
  }

  @Put(':id/resubmit')
  @ApiOperation({ summary: 'Resubmit a rejected claim' })
  @ApiResponse({ status: 200, description: 'Claim prepared for resubmission' })
  async resubmitClaim(
    @Param('id') id: string,
    @Body() updatedData: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.resubmitClaim(id, updatedData, req.tenantDb);
  }
}