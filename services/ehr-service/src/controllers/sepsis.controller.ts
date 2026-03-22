import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { SepsisService } from '../services/sepsis.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Sepsis Management')
@ApiBearerAuth()
@Controller('sepsis')
@UseGuards(JwtAuthGuard)
export class SepsisController {
  constructor(
    private readonly sepsisService: SepsisService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('screenings')
  async screenForSepsis(@Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.screenForSepsis(data, req.user?.userId ?? (req.user as any)?.id, tenantDb);
  }

  @Post('bundles')
  async initiateSepsisBundle(@Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.initiateSepsisBundle(data, req.user?.userId ?? (req.user as any)?.id, tenantDb);
  }

  @Put('bundles/:id/element')
  async updateBundleElement(@Param('id') id: string, @Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.updateBundleElement(id, data.element, data.value, tenantDb);
  }

  @Put('bundles/:id/notes')
  async updateBundleNotes(@Param('id') id: string, @Body() data: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.updateBundleNotes(id, data.notes || '', tenantDb);
  }

  @Get('alerts')
  async getSepsisAlerts(@Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.sepsisService.getSepsisAlerts(tenantDb);
  }

  @Get('compliance')
  async getBundleCompliance(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    return this.sepsisService.getBundleCompliance(start, end, tenantDb);
  }

  @Get('bundles/worklist')
  async getBundleWorklist(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('includeCompleted') includeCompleted: string,
    @Query('focus') focus: string,
    @Query('limit') limit: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const parsedLimit = Number(limit);
    const includeDone = String(includeCompleted || '').toLowerCase() === 'true';

    return this.sepsisService.getBundleWorklist(tenantDb, {
      startDate: start,
      endDate: end,
      includeCompleted: includeDone,
      focus,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  /**
   * POST /sepsis/risk-score
   * Calculate qSOFA, SIRS, NEWS2 and composite sepsis probability from raw vitals.
   * Does NOT persist — use for real-time monitoring and nurse copilot.
   */
  @Post('risk-score')
  calculateRiskScore(@Body() vitals: any) {
    return this.sepsisService.calculateRiskFromVitals(vitals);
  }

  @Get('operational-brief')
  async getOperationalBrief(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('includeCompleted') includeCompleted: string,
    @Query('limit') limit: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const parsedLimit = Number(limit);
    const includeDone = String(includeCompleted || '').toLowerCase() === 'true';

    return this.sepsisService.getOperationalBrief(tenantDb, {
      startDate: start,
      endDate: end,
      includeCompleted: includeDone,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }
}
