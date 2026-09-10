import { UseGuards, Controller, Post, Get, Body, Query } from '@nestjs/common';
import { HimisReportingService } from '../services/himis-reporting.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

// A-004/MOAS-20: national MoHCC/HIMIS submission (including migrating from
// OpenMRS) is an administrative reporting function, not clinical-staff-facing.
@Controller('himis')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class HimisReportingController {
  constructor(private readonly svc: HimisReportingService) {}

  // ── MOHCC HIMIS ────────────────────────────────────────────────────────────

  @Post('submit/monthly')
  submitMonthly(
    @Body('subdomain') subdomain: string,
    @Body('periodLabel') periodLabel: string,
    @Body('submittedBy') submittedBy?: string,
  ) {
    return this.svc.submitHimisMonthly(subdomain, periodLabel, submittedBy);
  }

  @Get('submissions')
  getSubmissions(
    @Query('subdomain') subdomain: string,
    @Query('reportType') reportType?: string,
  ) {
    return this.svc.getSubmissions(subdomain, reportType);
  }

  // ── OpenMRS Migration ──────────────────────────────────────────────────────

  @Post('openmrs/migrate')
  migrateFromOpenMrs(
    @Body('subdomain') subdomain: string,
    @Body('batchId') batchId: string,
    @Body('records') records: Array<{ resourceType: string; openmrsUuid: string; data: any }>,
  ) {
    return this.svc.migrateFromOpenMrs(subdomain, batchId, records);
  }

  @Get('openmrs/logs')
  getMigrationLogs(
    @Query('subdomain') subdomain: string,
    @Query('batchId') batchId?: string,
  ) {
    return this.svc.getMigrationLogs(subdomain, batchId);
  }
}
