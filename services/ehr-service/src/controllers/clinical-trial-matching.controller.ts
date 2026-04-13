import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { ClinicalTrialMatchingService } from '../services/clinical-trial-matching.service';

@Controller('trials')
export class ClinicalTrialMatchingController {
  constructor(private readonly svc: ClinicalTrialMatchingService) {}

  @Post('match')
  matchTrials(
    @Body('subdomain') subdomain: string,
    @Body('patientId') patientId: string,
    @Body('condition') condition?: string,
  ) {
    return this.svc.matchTrials(subdomain, patientId, condition);
  }

  @Post('match/pactr')
  matchPACTRTrials(
    @Body('subdomain') subdomain: string,
    @Body('patientId') patientId: string,
    @Body('condition') condition?: string,
  ) {
    return this.svc.matchPACTRTrials(subdomain, patientId, condition);
  }

  @Get('patient/:patientId')
  getMatches(@Param('patientId') patientId: string, @Query('subdomain') subdomain: string) {
    return this.svc.getMatches(subdomain, patientId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateStatus(subdomain, id, status);
  }

  @Get('pactr/search')
  searchPACTR(@Query('condition') condition: string) {
    return this.svc.searchPACTR(condition);
  }
}
