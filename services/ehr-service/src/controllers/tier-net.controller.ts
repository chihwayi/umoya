import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { TierNetService } from '../services/tier-net.service';

@Controller('tier-net')
@UseGuards(JwtAuthGuard)
export class TierNetController {
  constructor(private readonly tierNetService: TierNetService) {}

  @Post('export/:patientId')
  exportPatient(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.tierNetService.exportPatient(req.tenantId, patientId);
  }

  @Post('export/batch')
  batchExport(@Request() req: RequestWithTenant) {
    return this.tierNetService.batchExport(req.tenantId);
  }

  @Get('exports')
  getExports(@Request() req: RequestWithTenant) {
    return this.tierNetService.getExports(req.tenantId);
  }

  @Get('exports/:id/download')
  async downloadExport(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return { xml: await this.tierNetService.downloadExport(req.tenantId, id) };
  }
}
