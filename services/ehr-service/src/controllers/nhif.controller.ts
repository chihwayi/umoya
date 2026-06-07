import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NhifService } from '../services/nhif.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('nhif')
@UseGuards(JwtAuthGuard)
export class NhifController {
  constructor(private readonly nhifService: NhifService) {}

  @Post('schemes')
  createScheme(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nhifService.createScheme(req.tenantId, body);
  }

  @Get('schemes')
  getSchemes(@Query('countryCode') countryCode: string, @Request() req: RequestWithTenant) {
    return this.nhifService.getSchemes(req.tenantId, countryCode);
  }

  @Post('members')
  enrollMember(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nhifService.enrollMember(req.tenantId, body);
  }

  @Get('members/:patientId')
  getMembersByPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nhifService.getMembersByPatient(req.tenantId, patientId);
  }

  @Post('claims')
  submitClaim(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nhifService.submitClaim(req.tenantId, body);
  }

  @Get('claims')
  getClaims(
    @Query('status') status: string,
    @Query('schemeId') schemeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Request() req: RequestWithTenant,
  ) {
    return this.nhifService.getClaims(req.tenantId, {
      status,
      schemeId,
      from,
      to,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Patch('claims/:id')
  updateClaim(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.nhifService.updateClaim(req.tenantId, id, body);
  }

  @Post('capitation')
  recordCapitationPayment(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nhifService.recordCapitationPayment(req.tenantId, body);
  }

  @Get('capitation/report')
  getCapitationReport(@Query('schemeId') schemeId: string, @Request() req: RequestWithTenant) {
    return this.nhifService.getCapitationReport(req.tenantId, schemeId);
  }

  @Post('eligibility/:memberId')
  checkEligibility(@Param('memberId') memberId: string, @Request() req: RequestWithTenant) {
    return this.nhifService.checkEligibility(req.tenantId, memberId);
  }

  /* Sprint 149: NHIF / CBHI Capitation Billing Endpoints */

  @Post('patient/:patientId/enroll')
  async enrollCapitation(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.nhifService.enrollMemberCapitation(req.tenantId, patientId, body);
  }

  @Get('patient/:patientId/membership')
  async getMembershipCapitation(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    // Always return a well-formed JSON object. Returning a bare `null` (no active
    // membership) produced an empty response body the client failed to parse
    // ("XML Parsing Error: no root element found").
    const member = await this.nhifService.getMemberCapitation(req.tenantId, patientId);
    return { member: member ?? null, hasMembership: !!member };
  }

  @Post('patient/:patientId/claims')
  async createClaimCapitation(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? '';
    return this.nhifService.createCapitationClaim(req.tenantId, patientId, userId, body);
  }

  @Post('claims/:id/submit')
  async submitClaimCapitation(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.nhifService.submitCapitationClaim(req.tenantId, id);
  }

  @Get('patient/:patientId/claims')
  async getClaimsByPatientCapitation(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.nhifService.getClaimsByPatient(req.tenantId, patientId);
  }

  @Get('schemes/:schemeCode/tariffs')
  async getTariffsCapitation(@Param('schemeCode') schemeCode: string, @Request() req: RequestWithTenant) {
    return this.nhifService.getTariffSchedule(req.tenantId, schemeCode);
  }

  @Post('cdss/check-eligibility')
  async checkEligibilityCapitation(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.nhifService.verifyEligibilityCapitation(req.tenantId, body);
  }
}
