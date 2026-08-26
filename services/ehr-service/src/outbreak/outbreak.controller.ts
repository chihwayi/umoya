import { Controller, Get, Post, Body, Headers, Query, UseGuards } from '@nestjs/common';
import { OutbreakProtocolService } from './outbreak.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('outbreak')
@UseGuards(JwtAuthGuard)
export class OutbreakProtocolController {
  constructor(private readonly outbreakService: OutbreakProtocolService) {}

  @Post('plague')
  async createPlagueCase(
    @Headers('x-tenant-id') tenantId: string,
    @Body() data: any,
  ) {
    return this.outbreakService.createPlagueCase(tenantId, data);
  }

  @Get('plague')
  async getPlagueCases(
    @Headers('x-tenant-id') tenantId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.outbreakService.getPlagueCases(tenantId, patientId);
  }

  @Post('yellow-fever')
  async createYellowFeverCase(
    @Headers('x-tenant-id') tenantId: string,
    @Body() data: any,
  ) {
    return this.outbreakService.createYellowFeverCase(tenantId, data);
  }

  @Get('yellow-fever')
  async getYellowFeverCases(
    @Headers('x-tenant-id') tenantId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.outbreakService.getYellowFeverCases(tenantId, patientId);
  }

  @Post('meningitis')
  async createMeningitisCase(
    @Headers('x-tenant-id') tenantId: string,
    @Body() data: any,
  ) {
    return this.outbreakService.createMeningitisCase(tenantId, data);
  }

  @Get('meningitis')
  async getMeningitisCases(
    @Headers('x-tenant-id') tenantId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.outbreakService.getMeningitisCases(tenantId, patientId);
  }
}
