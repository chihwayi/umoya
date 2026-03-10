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

  @Get('readiness/worklist')
  @ApiOperation({ summary: 'Get claim readiness and denial-prevention worklist' })
  @ApiResponse({ status: 200, description: 'Claim readiness worklist retrieved' })
  async getClaimReadinessWorklist(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.claimsService.getClaimReadinessWorklist(query, req.tenantDb);
  }

  @Get()
  @ApiOperation({ summary: 'Get all claims with filtering' })
  @ApiResponse({ status: 200, description: 'Claims retrieved successfully' })
  async getClaims(@Query() query: any, @Request() req: RequestWithTenant) {
    return this.claimsService.getClaims(query, req.tenantDb);
  }

  @Get(':id/readiness')
  @ApiOperation({ summary: 'Get claim readiness, missing-document, and denial-risk analysis' })
  @ApiResponse({ status: 200, description: 'Claim readiness analysis retrieved' })
  async getClaimReadiness(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.claimsService.getClaimReadiness(id, req.tenantDb);
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

  @Post('from-appointment/:appointmentId')
  @ApiOperation({ summary: 'Generate claim automatically from a completed appointment' })
  @ApiResponse({ status: 201, description: 'Claim generated successfully' })
  async generateClaimFromAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() claimData: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.generateClaimFromAppointment(appointmentId, claimData, req.tenantDb);
  }

  @Post('from-procedure/:procedureId')
  @ApiOperation({ summary: 'Generate claim automatically from a procedure (lab/imaging)' })
  @ApiQuery({ name: 'type', enum: ['lab', 'imaging', 'other'], required: true })
  @ApiResponse({ status: 201, description: 'Claim generated successfully' })
  async generateClaimFromProcedure(
    @Param('procedureId') procedureId: string,
    @Query('type') type: 'lab' | 'imaging' | 'other',
    @Body() claimData: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.generateClaimFromProcedure(procedureId, type, claimData, req.tenantDb);
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

  // Sprint 14.2 Enhanced Endpoints

  @Post(':id/submit-enhanced')
  @ApiOperation({ summary: 'Submit claim with enhanced tracking and API integration' })
  @ApiQuery({ name: 'method', enum: ['api', 'edi', 'manual'], required: false })
  @ApiResponse({ status: 200, description: 'Claim submitted successfully' })
  async submitClaimEnhanced(
    @Param('id') id: string,
    @Query('method') method: 'api' | 'edi' | 'manual',
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.submitClaimEnhanced(id, method || 'api', req.tenantDb);
  }

  @Get(':id/status-enhanced')
  @ApiOperation({ summary: 'Check claim status with enhanced tracking and history' })
  @ApiResponse({ status: 200, description: 'Claim status retrieved with history' })
  async checkClaimStatusEnhanced(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.claimsService.checkClaimStatusEnhanced(id, req.tenantDb);
  }

  @Get(':id/status-history')
  @ApiOperation({ summary: 'Get claim status change history' })
  @ApiResponse({ status: 200, description: 'Status history retrieved' })
  async getClaimStatusHistory(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.claimsService.getClaimStatusHistory(id, req.tenantDb);
  }

  @Post(':id/response-enhanced')
  @ApiOperation({ summary: 'Process enhanced claim response from medical aid (webhook/polling)' })
  @ApiResponse({ status: 200, description: 'Response processed successfully' })
  async processClaimResponse(
    @Param('id') id: string,
    @Body() responseData: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.processClaimResponse(id, responseData, req.tenantDb);
  }

  @Post('bulk/submit')
  @ApiOperation({ summary: 'Bulk submit multiple claims' })
  @ApiResponse({ status: 200, description: 'Bulk submission completed' })
  async bulkSubmitClaims(
    @Body() body: { claimIds: string[]; method?: 'api' | 'edi' },
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.bulkSubmitClaims(
      body.claimIds,
      body.method || 'api',
      req.tenantDb,
    );
  }

  @Post('bulk/check-status')
  @ApiOperation({ summary: 'Bulk check status for multiple claims' })
  @ApiResponse({ status: 200, description: 'Bulk status check completed' })
  async bulkCheckClaimStatuses(
    @Body() body: { claimIds: string[] },
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.bulkCheckClaimStatuses(body.claimIds, req.tenantDb);
  }

  // Pre-Authorization Endpoints

  @Post('pre-authorizations')
  @ApiOperation({ summary: 'Create a pre-authorization request' })
  @ApiResponse({ status: 201, description: 'Pre-authorization created successfully' })
  async createPreAuthorization(
    @Body() preAuthData: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.createPreAuthorization(preAuthData, req.tenantDb);
  }

  @Get('pre-authorizations')
  @ApiOperation({ summary: 'Get pre-authorization requests' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'medicalAidName', required: false })
  @ApiResponse({ status: 200, description: 'Pre-authorizations retrieved' })
  async getPreAuthorizations(
    @Query() query: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.getPreAuthorizations(query, req.tenantDb);
  }

  @Post('pre-authorizations/:id/submit')
  @ApiOperation({ summary: 'Submit pre-authorization to medical aid' })
  @ApiResponse({ status: 200, description: 'Pre-authorization submitted successfully' })
  async submitPreAuthorization(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.submitPreAuthorization(id, req.tenantDb);
  }

  @Post(':id/link-preauth/:preAuthId')
  @ApiOperation({ summary: 'Link a claim to an approved pre-authorization' })
  @ApiResponse({ status: 200, description: 'Claim linked to pre-authorization' })
  async linkClaimToPreAuth(
    @Param('id') claimId: string,
    @Param('preAuthId') preAuthId: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.claimsService.linkClaimToPreAuth(claimId, preAuthId, req.tenantDb);
  }
}
