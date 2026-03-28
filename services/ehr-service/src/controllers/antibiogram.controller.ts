import { Controller, Get, Post, Body, Param, Headers, Query } from '@nestjs/common';
import { AntibiogramService } from '../services/antibiogram.service';

@Controller('antibiogram')
export class AntibiogramController {
  constructor(private readonly svc: AntibiogramService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('entry')
  addEntry(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.addEntry(this.tenant(h), dto);
  }

  @Get('entry')
  getEntries(
    @Headers() h: Record<string, string>,
    @Query('organism') organism?: string,
    @Query('specimenType') specimenType?: string,
  ) {
    return this.svc.getEntries(this.tenant(h), organism, specimenType);
  }

  @Post('patient/:patientId/culture')
  addCultureResult(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addCultureResult(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/culture')
  getCultureResults(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getCultureResults(this.tenant(h), patientId);
  }

  @Get('summary')
  getLatestSummary(@Headers() h: Record<string, string>, @Query('specimenType') specimenType?: string) {
    return this.svc.getLatestSummary(this.tenant(h), specimenType);
  }

  @Post('recalculate')
  recalculate(@Headers() h: Record<string, string>) {
    return this.svc.recalculate(this.tenant(h));
  }

  @Post('cdss/empirical')
  empirical(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.empiricalRecommendation(this.tenant(h), dto);
  }

  @Post('cdss/deescalate')
  deescalate(@Headers() h: Record<string, string>, @Body() dto: any) {
    return this.svc.deescalateRecommendation(this.tenant(h), dto);
  }
}
