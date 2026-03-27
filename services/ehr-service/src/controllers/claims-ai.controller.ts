import { Controller, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ClaimsAiService, ClaimPayload } from '../services/claims-ai.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Claims AI')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('claims')
export class ClaimsAiController {
  constructor(private readonly claimsAiService: ClaimsAiService) {}

  @Post('score')
  @ApiOperation({ summary: 'Score a claim for denial risk before submission' })
  async scoreClaim(
    @Body() body: { claim: ClaimPayload },
    @Request() req: RequestWithTenant,
  ) {
    const tenantId = req.tenantId || 'default';
    return this.claimsAiService.scoreClaimBeforeSubmission(body.claim, tenantId, req.tenantDb);
  }

  @Post(':claimId/appeal')
  @ApiOperation({ summary: 'Generate an AI appeal letter for a denied claim' })
  async generateAppeal(
    @Param('claimId') claimId: string,
    @Body() body: { patientId: string; denialReasonCode: string; claimDetails: Record<string, unknown> },
    @Request() req: RequestWithTenant,
  ) {
    const tenantId = req.tenantId || 'default';
    return this.claimsAiService.generateAppealTemplate(
      claimId,
      body.patientId,
      body.denialReasonCode,
      body.claimDetails,
      tenantId,
      req.tenantDb,
    );
  }

  @Patch('risk-score/:id/override')
  @ApiOperation({ summary: 'Override a blocked claim submission with clinical justification' })
  async overrideBlock(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: RequestWithTenant,
  ) {
    const userId = req.user?.sub || req.user?.id || 'unknown';
    await this.claimsAiService.overrideBlock(id, userId, body.reason, req.tenantDb);
    return { overridden: true };
  }

  @Post(':claimId/outcome')
  @ApiOperation({ summary: 'Record actual claim outcome to feed the self-learning loop' })
  async recordOutcome(
    @Param('claimId') claimId: string,
    @Body() body: { outcome: 'approved' | 'denied' | 'partial' | 'appealed' },
    @Request() req: RequestWithTenant,
  ) {
    await this.claimsAiService.recordClaimOutcome(claimId, body.outcome, req.tenantDb);
    return { recorded: true };
  }

  @Post('pharmacy/pdmp-check')
  @ApiOperation({ summary: 'PDMP controlled substance AI risk check' })
  async pdmpCheck(
    @Body() body: {
      patientId: string;
      prescriberId: string;
      drugName: string;
      deaSchedule?: string;
      dailyDoseMg?: number;
    },
    @Request() req: RequestWithTenant,
  ) {
    const tenantId = req.tenantId || 'default';
    return this.claimsAiService.checkPdmp(
      body.patientId,
      body.prescriberId,
      body.drugName,
      body.deaSchedule || null,
      body.dailyDoseMg || 0,
      tenantId,
      req.tenantDb,
    );
  }
}
