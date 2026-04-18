import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { SurveillanceService } from './surveillance.service';

@Controller('surveillance')
@UseGuards(JwtAuthGuard)
export class SurveillanceController {
  constructor(private readonly surveillanceService: SurveillanceService) {}

  @Post('sormas/push')
  pushToSormas(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.surveillanceService.pushCaseToSormas(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      body ?? {},
    );
  }

  @Get('sormas/sync-status/:caseId')
  getSyncStatus(@Param('caseId') caseId: string, @Request() req: RequestWithTenant) {
    return this.surveillanceService.getSormasSyncStatus(req.tenantId!, caseId);
  }

  @Get('sormas/logs')
  getSormasLogs(@Request() req: RequestWithTenant) {
    return this.surveillanceService.getSormasSyncLogs(req.tenantId!);
  }

  @Post('sormas/retry/:logId')
  retrySync(@Param('logId') logId: string, @Request() req: RequestWithTenant) {
    return this.surveillanceService.retrySormasSync(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      logId,
    );
  }

  @Post('ihr')
  createIhr(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.surveillanceService.createIhrNotification(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      body ?? {},
    );
  }

  @Get('ihr')
  getIhr(@Request() req: RequestWithTenant) {
    return this.surveillanceService.getIhrNotifications(req.tenantId!);
  }

  @Patch('ihr/:id')
  updateIhr(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.surveillanceService.updateIhrNotification(req.tenantId!, id, body ?? {});
  }

  @Post('ihr/:id/annex2-assessment')
  runAnnex2(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.surveillanceService.runIhrAnnex2Assessment(req.tenantId!, id, body ?? {});
  }

  @Post('ebs')
  reportSignal(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.surveillanceService.reportEbsSignal(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      body ?? {},
    );
  }

  @Get('ebs')
  getSignals(@Query('status') status: string | undefined, @Request() req: RequestWithTenant) {
    return this.surveillanceService.getEbsSignals(req.tenantId!, status);
  }

  @Patch('ebs/:id')
  updateSignal(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.surveillanceService.updateEbsSignal(req.tenantId!, id, body ?? {});
  }

  @Get('summary')
  summary(@Request() req: RequestWithTenant) {
    return this.surveillanceService.getSurveillanceSummary(req.tenantId!);
  }
}
