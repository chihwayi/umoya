import { Controller, Get, Param, Post, Patch, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Dhis2ValidationService } from '../services/dhis2-validation.service';

@Controller('tenants/:tenantId/dhis2-validation')
@UseGuards(JwtAuthGuard)
export class Dhis2ValidationController {
  constructor(private readonly dhis2Validation: Dhis2ValidationService) {}

  @Post('run')
  runValidation(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string,
  ) {
    return this.dhis2Validation.runValidationForTenant(tenantId, period);
  }

  @Get('outliers')
  getOutliers(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string,
  ) {
    return this.dhis2Validation.getOutlierReport(tenantId, period);
  }

  @Get('history/:dataElementId')
  getHistory(
    @Param('tenantId') tenantId: string,
    @Param('dataElementId') dataElementId: string,
    @Query('periods') periods: string,
  ) {
    return this.dhis2Validation.getValidationHistory(tenantId, dataElementId, Number(periods) || 6);
  }

  @Get('dqa-score')
  getDqaScore(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string,
  ) {
    return this.dhis2Validation.getDqaScore(tenantId, period);
  }

  @Patch('alerts/:dataElementId/resolve')
  resolveAlert(
    @Param('tenantId') tenantId: string,
    @Param('dataElementId') dataElementId: string,
    @Query('period') period: string,
    @Body() body: { resolution: 'investigated' | 'accepted_correct' | 'corrected'; resolvedBy: string; note?: string },
  ) {
    return this.dhis2Validation.resolveAlert(
      tenantId, dataElementId, period, body.resolution, body.resolvedBy, body.note,
    );
  }
}
