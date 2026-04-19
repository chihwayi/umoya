import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CbhiService } from '../services/cbhi.service';

@Controller('cbhi')
@UseGuards(JwtAuthGuard)
export class CbhiController {
  constructor(private readonly cbhiService: CbhiService) {}

  @Post('households')
  registerHousehold(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cbhiService.registerHousehold(req.tenantId!, body ?? {});
  }

  @Get('households')
  getHouseholds(@Query('schemeId') schemeId: string | undefined, @Request() req: RequestWithTenant) {
    return this.cbhiService.getHouseholds(req.tenantId!, schemeId);
  }

  @Get('households/:id')
  getHousehold(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.cbhiService.getHousehold(req.tenantId!, id);
  }

  @Patch('households/:id')
  updateHousehold(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.cbhiService.updateHousehold(req.tenantId!, id, body ?? {});
  }

  @Get('verify/:patientId')
  verifyMembership(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.cbhiService.verifyMembership(req.tenantId!, patientId);
  }

  @Post('households/:id/members')
  addMember(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.cbhiService.addMember(req.tenantId!, id, body ?? {});
  }

  @Post('contributions')
  recordContribution(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cbhiService.recordContribution(req.tenantId!, body ?? {});
  }

  @Get('contributions/:householdId')
  getContributions(@Param('householdId') householdId: string, @Request() req: RequestWithTenant) {
    return this.cbhiService.getContributions(req.tenantId!, householdId);
  }

  @Post('claims')
  submitClaim(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cbhiService.submitClaim(req.tenantId!, body ?? {});
  }

  @Get('claims')
  getClaims(
    @Query('schemeId') schemeId: string | undefined,
    @Query('status') status: string | undefined,
    @Request() req: RequestWithTenant,
  ) {
    return this.cbhiService.getClaims(req.tenantId!, { schemeId, status });
  }

  @Patch('claims/:id/adjudicate')
  adjudicateClaim(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    const reviewedBy = (req.user as any)?.userId ?? (req.user as any)?.id ?? '';
    return this.cbhiService.adjudicateClaim(req.tenantId!, id, {
      status: body?.status,
      approvedAmount: Number(body?.approvedAmount || 0),
      rejectionReason: body?.rejectionReason,
      reviewedBy,
    });
  }

  @Get('summary/:schemeId')
  summary(@Param('schemeId') schemeId: string, @Request() req: RequestWithTenant) {
    return this.cbhiService.getCbhiSummary(req.tenantId!, schemeId);
  }
}
