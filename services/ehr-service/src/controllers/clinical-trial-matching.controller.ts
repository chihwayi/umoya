import { UseGuards, Controller, Post, Get, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { ClinicalTrialMatchingService } from '../services/clinical-trial-matching.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('trials')
@UseGuards(JwtAuthGuard)
export class ClinicalTrialMatchingController {
  constructor(private readonly svc: ClinicalTrialMatchingService) {}

  @Post('match')
  matchTrials(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body('condition') condition?: string,
  ) {
    return this.svc.matchTrials(req.tenantDb!, patientId, condition);
  }

  @Post('match/pactr')
  matchPACTRTrials(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body('condition') condition?: string,
  ) {
    return this.svc.matchPACTRTrials(req.tenantDb!, patientId, condition);
  }

  @Get('patient/:patientId')
  getMatches(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getMatches(req.tenantDb!, patientId);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateStatus(req.tenantDb!, id, status);
  }

  @Get('pactr/search')
  searchPACTR(@Query('condition') condition: string) {
    return this.svc.searchPACTR(condition);
  }
}
