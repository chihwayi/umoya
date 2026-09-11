import { UseGuards, Controller, Post, Get, Body, Query, Req } from '@nestjs/common';
import { HimisReportingService } from '../services/himis-reporting.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

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
    @Req() req: RequestWithTenant,
    @Body('periodLabel') periodLabel: string,
    @Body('submittedBy') submittedBy?: string,
  ) {
    return this.svc.submitHimisMonthly(req.tenantDb!, periodLabel, submittedBy);
  }

  @Get('submissions')
  getSubmissions(
    @Req() req: RequestWithTenant,
    @Query('reportType') reportType?: string,
  ) {
    return this.svc.getSubmissions(req.tenantDb!, reportType);
  }

  // ── OpenMRS Migration ──────────────────────────────────────────────────────

  @Post('openmrs/migrate')
  migrateFromOpenMrs(
    @Req() req: RequestWithTenant,
    @Body('batchId') batchId: string,
    @Body('records') records: Array<{ resourceType: string; openmrsUuid: string; data: any }>,
  ) {
    return this.svc.migrateFromOpenMrs(req.tenantDb!, batchId, records);
  }

  @Get('openmrs/logs')
  getMigrationLogs(
    @Req() req: RequestWithTenant,
    @Query('batchId') batchId?: string,
  ) {
    return this.svc.getMigrationLogs(req.tenantDb!, batchId);
  }
}
