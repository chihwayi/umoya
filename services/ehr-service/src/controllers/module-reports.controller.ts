import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ModuleReportsService } from '../services/module-reports.service';

@Controller('tenants/:tenantId/module-reports')
@UseGuards(JwtAuthGuard)
export class ModuleReportsController {
  constructor(private readonly moduleReports: ModuleReportsService) {}

  @Get()
  listModules() {
    return this.moduleReports.listAvailableModules();
  }

  @Get(':module')
  getReport(
    @Param('tenantId') tenantId: string,
    @Param('module') module: string,
    @Query('period') period: string,
  ) {
    const p = period || new Date().toISOString().slice(0, 7).replace('-', '');
    return this.moduleReports.getModuleReport(tenantId, module as any, p);
  }
}
