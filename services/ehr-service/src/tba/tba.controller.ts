import { Controller, Get, Post, Patch, Body, Param, Query, Headers, ParseUUIDPipe } from '@nestjs/common';
import { TbaService } from './tba.service';
import { TbaRegister } from './entities/tba-register.entity';
import { HomeBirthRecord } from './entities/home-birth-record.entity';

@Controller('tba')
export class TbaController {
  constructor(private readonly tbaService: TbaService) {}

  // ── TBA Register ───────────────────────────────────────────────────────────

  @Post('register')
  async registerTba(@Headers('x-tenant-id') tenantId: string, @Body() data: Partial<TbaRegister>) {
    return this.tbaService.registerTba(tenantId, data);
  }

  @Get('register')
  async getTbas(@Headers('x-tenant-id') tenantId: string, @Query('district') district?: string) {
    return this.tbaService.getTbas(tenantId, district);
  }

  @Get('register/:id')
  async getTbaById(@Headers('x-tenant-id') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.tbaService.getTbaById(tenantId, id);
  }

  @Patch('register/:id')
  async updateTba(@Headers('x-tenant-id') tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() data: Partial<TbaRegister>) {
    return this.tbaService.updateTba(tenantId, id, data);
  }

  @Post('register/:id/score-risk')
  async scoreTbaRisk(@Headers('x-tenant-id') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.tbaService.scoreTbaRisk(tenantId, id);
  }

  // ── Home Birth Records ──────────────────────────────────────────────────────

  @Post('births')
  async recordHomeBirth(@Headers('x-tenant-id') tenantId: string, @Body() data: Partial<HomeBirthRecord>) {
    return this.tbaService.recordHomeBirth(tenantId, data);
  }

  @Get('births')
  async getHomeBirths(@Headers('x-tenant-id') tenantId: string, @Query() filters?: any) {
    // Example filters: patientId, tbaId, district, startDate, endDate
    return this.tbaService.getHomeBirths(tenantId, filters);
  }

  @Get('births/:id')
  async getHomeBirthById(@Headers('x-tenant-id') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.tbaService.getHomeBirthById(tenantId, id);
  }

  @Patch('births/:id')
  async updateHomeBirth(@Headers('x-tenant-id') tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() data: Partial<HomeBirthRecord>) {
    return this.tbaService.updateHomeBirth(tenantId, id, data);
  }

  @Post('births/:id/notify-crvs')
  async notifyCRVS(@Headers('x-tenant-id') tenantId: string, @Param('id', ParseUUIDPipe) birthId: string) {
    return this.tbaService.notifyCRVS(tenantId, birthId);
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  @Get('summary/:district')
  async getTbaSummary(@Headers('x-tenant-id') tenantId: string, @Param('district') district: string) {
    return this.tbaService.getTbaSummary(tenantId, district);
  }
}
