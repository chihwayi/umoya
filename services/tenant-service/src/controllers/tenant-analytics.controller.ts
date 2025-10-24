import { Controller, Get, Param, Query } from '@nestjs/common';
import { TenantAnalyticsService } from '../services/tenant-analytics.service';

@Controller('analytics')
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
}