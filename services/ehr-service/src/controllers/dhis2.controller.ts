import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Dhis2Service } from '../services/dhis2.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('DHIS2 Integration')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dhis2')
export class Dhis2Controller {
  constructor(private dhis2Service: Dhis2Service) {}

  @Post('sync/patients')
  @ApiOperation({ summary: 'Sync patients to DHIS2' })
  @ApiResponse({ status: 200, description: 'Patients synced successfully' })
  async syncPatients(@Request() req: RequestWithTenant) {
    return this.dhis2Service.syncPatients(req.tenantDb, req.tenantId);
  }

  @Post('events')
  @ApiOperation({ summary: 'Send event to DHIS2' })
  @ApiResponse({ status: 201, description: 'Event sent successfully' })
  async sendEvent(@Body() eventData: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendEvent(eventData, req.tenantId);
  }

  @Post('data-values')
  @ApiOperation({ summary: 'Send data values to DHIS2' })
  @ApiResponse({ status: 201, description: 'Data values sent successfully' })
  async sendDataValues(@Body() dataValues: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendDataValues(dataValues, req.tenantId);
  }

  @Get('programs')
  @ApiOperation({ summary: 'Get DHIS2 programs' })
  @ApiResponse({ status: 200, description: 'Programs retrieved successfully' })
  async getPrograms(@Request() req: RequestWithTenant) {
    return this.dhis2Service.getPrograms(req.tenantId);
  }

  @Get('data-elements')
  @ApiOperation({ summary: 'Get DHIS2 data elements' })
  @ApiResponse({ status: 200, description: 'Data elements retrieved successfully' })
  async getDataElements(@Query('program') program: string, @Request() req: RequestWithTenant) {
    return this.dhis2Service.getDataElements(program, req.tenantId);
  }

  @Post('reports/aggregate')
  @ApiOperation({ summary: 'Send aggregate report to DHIS2' })
  @ApiResponse({ status: 201, description: 'Report sent successfully' })
  async sendAggregateReport(@Body() reportData: any, @Request() req: RequestWithTenant) {
    return this.dhis2Service.sendAggregateReport(reportData, req.tenantDb, req.tenantId);
  }

  @Get('sync-status')
  @ApiOperation({ summary: 'Get DHIS2 sync status' })
  @ApiResponse({ status: 200, description: 'Sync status retrieved' })
  async getSyncStatus(@Request() req: RequestWithTenant) {
    return this.dhis2Service.getSyncStatus(req.tenantDb, req.tenantId);
  }
}
