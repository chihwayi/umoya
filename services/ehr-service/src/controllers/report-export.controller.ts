import {
  Controller, Post, Body, Param, Res, Query, Request, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ReportExportService, ReportDefinition } from '../services/report-export.service';
import { MonthlyReportBundleService } from '../services/monthly-report-bundle.service';

@Controller('tenants/:tenantId/exports')
@UseGuards(JwtAuthGuard)
export class ReportExportController {
  constructor(
    private readonly exportSvc: ReportExportService,
    private readonly bundleSvc: MonthlyReportBundleService,
  ) {}

  @Post('pdf')
  async exportPdf(
    @Param('tenantId') tenantId: string,
    @Body() definition: ReportDefinition,
    @Res() res: Response,
  ) {
    definition.generatedAt = new Date(definition.generatedAt);
    const buf = await this.exportSvc.generatePdf(definition);
    const filename = `umoya-${definition.title.toLowerCase().replace(/\s+/g, '-')}-${definition.period}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buf.length,
    });
    res.end(buf);
  }

  @Post('xlsx')
  async exportXlsx(
    @Param('tenantId') tenantId: string,
    @Body() definition: ReportDefinition,
    @Res() res: Response,
  ) {
    definition.generatedAt = new Date(definition.generatedAt);
    const buf = await this.exportSvc.generateXlsx(definition);
    const filename = `umoya-${definition.title.toLowerCase().replace(/\s+/g, '-')}-${definition.period}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buf.length,
    });
    res.end(buf);
  }

  @Post('csv')
  exportCsv(
    @Param('tenantId') tenantId: string,
    @Body() body: { rows: Record<string, any>[]; columns?: string[]; filename?: string },
    @Res() res: Response,
  ) {
    const csv = this.exportSvc.generateCsv(body.rows, body.columns);
    const filename = (body.filename ?? 'umoya-export') + '.csv';
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.end(csv);
  }

  @Post('monthly-bundle')
  async monthlyBundle(
    @Param('tenantId') tenantId: string,
    @Query('period') period: string,
    @Res() res: Response,
    @Request() req: RequestWithTenant,
  ) {
    const zip = await this.bundleSvc.generateMonthlyBundle(req.tenantDb!, tenantId, period);
    const filename = `umoya-monthly-bundle-${period}.zip`;
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': zip.length,
    });
    res.end(zip);
  }
}
