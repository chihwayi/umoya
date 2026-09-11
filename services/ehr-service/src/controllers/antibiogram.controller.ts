import { UseGuards, Controller, Get, Post, Body, Param, Req, Query } from '@nestjs/common';
import { AntibiogramService } from '../services/antibiogram.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('antibiogram')
@UseGuards(JwtAuthGuard)
export class AntibiogramController {
  constructor(private readonly svc: AntibiogramService) {}

  @Post('entry')
  addEntry(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.addEntry(req.tenantDb!, dto);
  }

  @Get('entry')
  getEntries(
    @Req() req: RequestWithTenant,
    @Query('organism') organism?: string,
    @Query('specimenType') specimenType?: string,
  ) {
    return this.svc.getEntries(req.tenantDb!, organism, specimenType);
  }

  @Post('patient/:patientId/culture')
  addCultureResult(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCultureResult(req.tenantId!, req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/culture')
  getCultureResults(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getCultureResults(req.tenantDb!, patientId);
  }

  @Get('summary')
  getLatestSummary(@Req() req: RequestWithTenant, @Query('specimenType') specimenType?: string) {
    return this.svc.getLatestSummary(req.tenantDb!, specimenType);
  }

  @Post('recalculate')
  recalculate(@Req() req: RequestWithTenant) {
    return this.svc.recalculate(req.tenantDb!);
  }

  @Post('cdss/empirical')
  empirical(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.empiricalRecommendation(req.tenantId!, req.tenantDb!, dto);
  }

  @Post('cdss/deescalate')
  deescalate(@Req() req: RequestWithTenant, @Body() dto: any) {
    return this.svc.deescalateRecommendation(req.tenantId!, req.tenantDb!, dto);
  }
}
