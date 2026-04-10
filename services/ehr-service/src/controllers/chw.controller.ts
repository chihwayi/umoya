import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ChwService } from '../services/chw.service';

@Controller('chw')
@UseGuards(JwtAuthGuard)
export class ChwController {
  constructor(private readonly chwService: ChwService) {}

  @Post('households')
  async registerHousehold(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.chwService.registerHousehold(req.tenantId, body);
  }

  @Get('households')
  async getHouseholds(
    @Query('chwId') chwId: string,
    @Query('village') village: string,
    @Query('ward') ward: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.chwService.getHouseholds(req.tenantId, {
      chwId,
      village,
      ward,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('households/:id')
  async getHouseholdDetail(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.chwService.getHouseholdDetail(req.tenantId, id);
  }

  @Post('households/:id/members')
  async addMember(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.chwService.addMember(req.tenantId, id, body);
  }

  @Post('visits')
  async recordVisit(@Body() body: any, @Request() req: RequestWithTenant) {
    const chwId = body.chwId || req.user?.sub || req.user?.id;
    return this.chwService.recordVisit(req.tenantId, chwId, { ...body, chwId });
  }

  @Get('visits')
  async getVisits(
    @Query('chwId') chwId: string,
    @Query('householdId') householdId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.chwService.getVisits(req.tenantId, {
      chwId,
      householdId,
      from,
      to,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Get('tasks')
  async getTasks(
    @Query('chwId') chwId: string,
    @Query('status') status: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.chwService.getTasks(req.tenantId, chwId, status);
  }

  @Post('tasks')
  async assignTask(@Body() body: any, @Request() req: RequestWithTenant) {
    const assignedBy = req.user?.sub || req.user?.id || body.assignedBy;
    return this.chwService.assignTask(req.tenantId, body, assignedBy);
  }

  @Patch('tasks/:id/complete')
  async completeTask(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.chwService.completeTask(req.tenantId, id, body?.notes ?? null);
  }

  @Get('tally/:chwId/:date')
  async getDailyTally(
    @Param('chwId') chwId: string,
    @Param('date') date: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.chwService.getDailyTally(req.tenantId, chwId, date);
  }

  @Post('tally')
  async submitTally(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.chwService.submitTally(req.tenantId, body);
  }

  @Post('sync/batch')
  async batchSync(@Body() payload: any, @Request() req: RequestWithTenant) {
    return this.chwService.batchSync(req.tenantId, req.user?.sub || req.user?.id, payload);
  }

  @Get('supervision/dashboard')
  async getSupervisionDashboard(@Request() req: RequestWithTenant) {
    return this.chwService.getSupervisionDashboard(req.tenantId);
  }

  @Get('supervision/defaulters')
  async getDefaulters(@Request() req: RequestWithTenant) {
    return this.chwService.getDefaulters(req.tenantId);
  }
}
