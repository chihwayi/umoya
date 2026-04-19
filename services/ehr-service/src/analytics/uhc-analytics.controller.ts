import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { UhcAnalyticsService } from './uhc-analytics.service';

@Controller('analytics/uhc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UhcAnalyticsController {
  constructor(private readonly uhcService: UhcAnalyticsService) {}

  @Post('compute')
  @Roles('admin', 'public_health')
  computeIndicators(@Body() dto: { year: number; quarter?: number }, @Request() req: RequestWithTenant) {
    return this.uhcService.computeIndicators(req.tenantId!, dto.year, dto.quarter);
  }

  @Get('snapshots/latest')
  @Roles('admin', 'public_health', 'doctor')
  getLatest(@Request() req: RequestWithTenant) {
    return this.uhcService.getLatestSnapshot(req.tenantId!);
  }

  @Get('snapshots')
  @Roles('admin', 'public_health', 'doctor')
  getSnapshots(@Query('year') year: string | undefined, @Request() req: RequestWithTenant) {
    return this.uhcService.getSnapshots(req.tenantId!, year ? parseInt(year, 10) : undefined);
  }

  @Get('targets')
  @Roles('admin', 'public_health', 'doctor')
  getTargets(@Request() req: RequestWithTenant) {
    return this.uhcService.getTargets(req.tenantId!);
  }

  @Patch('targets/:code')
  @Roles('admin', 'public_health')
  updateTarget(
    @Param('code') code: string,
    @Body() dto: { targetValue: number; nationalTarget?: number },
    @Request() req: RequestWithTenant,
  ) {
    return this.uhcService.updateTarget(req.tenantId!, code, dto.targetValue, dto.nationalTarget);
  }

  @Post('snapshots/:id/push-dhis2')
  @Roles('admin', 'public_health')
  pushToDhis2(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.uhcService.pushToDhis2(req.tenantId!, id);
  }
}
