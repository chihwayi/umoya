import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { InfectionControlService } from '../services/infection-control.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Infection Control')
@ApiBearerAuth()
@Controller('infection-control')
@UseGuards(JwtAuthGuard)
export class InfectionControlController {
  constructor(
    private readonly infectionControlService: InfectionControlService,
    private readonly tenantService: TenantService,
  ) {}

  // ==================== INFECTION SURVEILLANCE ====================

  @Post('infections')
  @ApiOperation({ summary: 'Report infection case' })
  @ApiResponse({ status: 201, description: 'Infection reported' })
  async reportInfection(
    @Body() infectionData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.infectionControlService.reportInfection(infectionData, req.user?.userId ?? (req.user as any)?.id, tenantDb);
  }

  @Get('infections')
  @ApiOperation({ summary: 'Get infections by date range' })
  @ApiResponse({ status: 200, description: 'Infections retrieved' })
  async getInfections(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    return this.infectionControlService.getInfectionsByDateRange(start, end, tenantDb);
  }

  @Get('metrics/hai')
  @ApiOperation({ summary: 'Get HAI metrics' })
  @ApiResponse({ status: 200, description: 'HAI metrics retrieved' })
  async getHAIMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    return this.infectionControlService.getHAIMetrics(start, end, tenantDb);
  }

  // ==================== ISOLATION PRECAUTIONS ====================

  @Post('isolation')
  @ApiOperation({ summary: 'Order isolation precautions' })
  @ApiResponse({ status: 201, description: 'Isolation ordered' })
  async orderIsolation(
    @Body() isolationData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.infectionControlService.orderIsolation(isolationData, req.user?.userId ?? (req.user as any)?.id, tenantDb);
  }

  @Get('isolation/active')
  @ApiOperation({ summary: 'Get active isolation precautions' })
  @ApiResponse({ status: 200, description: 'Active isolations retrieved' })
  async getActiveIsolations(
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.infectionControlService.getActiveIsolations(tenantDb);
  }

  @Post('isolation/:id/discontinue')
  @ApiOperation({ summary: 'Discontinue isolation precautions' })
  @ApiResponse({ status: 200, description: 'Isolation discontinued' })
  async discontinueIsolation(
    @Param('id') id: string,
    @Body() data: { reason: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.infectionControlService.discontinueIsolation(id, data.reason, req.user?.userId ?? (req.user as any)?.id, tenantDb);
  }

  // ==================== ANTIMICROBIAL STEWARDSHIP ====================

  @Post('antimicrobial')
  @ApiOperation({ summary: 'Track antibiotic usage' })
  @ApiResponse({ status: 201, description: 'Antibiotic tracked' })
  async trackAntibiotic(
    @Body() stewardshipData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.infectionControlService.trackAntibiotic(stewardshipData, tenantDb);
  }

  @Get('antimicrobial/report')
  @ApiOperation({ summary: 'Get antibiotic usage report' })
  @ApiResponse({ status: 200, description: 'Report retrieved' })
  async getAntibioticUsageReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    return this.infectionControlService.getAntibioticUsageReport(start, end, tenantDb);
  }

  @Put('antimicrobial/:id/review')
  @ApiOperation({ summary: 'Review antibiotic appropriateness' })
  @ApiResponse({ status: 200, description: 'Review completed' })
  async reviewAntibiotic(
    @Param('id') id: string,
    @Body() reviewData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.infectionControlService.reviewAntibiotic(id, reviewData, req.user?.userId ?? (req.user as any)?.id, tenantDb);
  }

  @Post('hand-hygiene')
  @ApiOperation({ summary: 'Record hand hygiene observation' })
  async recordHandHygiene(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.infectionControlService.recordHandHygiene(body, userId, tenantDb);
  }

  @Get('hand-hygiene/compliance')
  @ApiOperation({ summary: 'Hand hygiene compliance by department/period' })
  async getHandHygieneCompliance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('department') department: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.infectionControlService.getHandHygieneCompliance(start, end, department || null, tenantDb);
  }

  @Post('device-days')
  @ApiOperation({ summary: 'Track device insertion' })
  async trackDeviceDay(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.infectionControlService.trackDeviceDay(body, userId, tenantDb);
  }

  @Put('device-days/:id/remove')
  @ApiOperation({ summary: 'Track device removal' })
  async removeDeviceDay(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.infectionControlService.removeDeviceDay(id, tenantDb);
  }

  @Get('device-days/rates')
  @ApiOperation({ summary: 'CAUTI/CLABSI/VAP rates per 1000 device-days' })
  async getDeviceDayRates(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    return this.infectionControlService.getDeviceDayRates(start, end, tenantDb);
  }
}




