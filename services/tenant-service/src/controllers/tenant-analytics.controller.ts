import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TenantAnalyticsService } from '../services/tenant-analytics.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class TenantAnalyticsController {
  constructor(private readonly analyticsService: TenantAnalyticsService) {}

  @Get('overview')
  async getSystemOverview(): Promise<any> {
    return this.analyticsService.getSystemWideStats();
  }

  @Get('tenants')
  async getAllTenantsOverview(): Promise<any> {
    return this.analyticsService.getAllTenantsOverview();
  }

  @Get('tenants/:tenantId')
  async getTenantMetrics(
    @Param('tenantId') tenantId: string,
    @Query('days') days?: number
  ): Promise<any> {
    return this.analyticsService.getTenantMetrics(tenantId, days || 30);
  }

  @Get('tenants/:tenantId/report')
  async generateTenantReport(@Param('tenantId') tenantId: string): Promise<any> {
    return this.analyticsService.generateTenantReport(tenantId);
  }

  @Get('tenants/:tenantId/report/export')
  async exportTenantReport(
    @Param('tenantId') tenantId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.analyticsService.generateTenantReport(tenantId);
    if (format === 'csv') {
      const rows = [
        ['Tenant', report.tenant?.clinicName ?? report.tenant?.subdomain ?? tenantId],
        ['Status', report.tenant?.status ?? ''],
        ['Total users', String(report.kpis?.totalUsers ?? report.users?.total ?? 0)],
        ['Active users', String(report.kpis?.activeUsers ?? report.users?.active ?? 0)],
        ['Last activity', report.kpis?.lastActivity ? new Date(report.kpis.lastActivity).toISOString() : ''],
        ['Generated', report.generatedAt ?? ''],
      ];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="tenant-report-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
      return;
    }
    res.json(report);
  }
}
