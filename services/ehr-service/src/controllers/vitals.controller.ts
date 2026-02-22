import { Controller, Post, Get, Body, Param, Req, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { VitalsService } from '../services/vitals.service';

@ApiTags('Vitals')
@Controller('vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Post()
  async record(@Body() body: any, @Req() req: any) {
    const tenantId = req.tenantId;
    const saved = await this.vitalsService.recordVitals(body, tenantId);
    return { success: true, vitals: saved, cdssInsights: saved.cdssInsights ?? null };
  }

  @Get('patient/:patientId')
  @ApiQuery({ name: 'trend', required: false, type: Boolean, description: 'Return trend view instead of raw entries' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of entries to return' })
  @ApiQuery({ name: 'recorded_date', required: false, type: String, description: 'Filter vitals by YYYY-MM-DD capture date' })
  @ApiQuery({ name: 'latest_on_date', required: false, type: Boolean, description: 'Return only latest vital for recorded_date' })
  async getByPatient(
    @Param('patientId') patientId: string,
    @Req() req: any,
    @Query('trend') trend?: string,
    @Query('limit') limit?: string,
    @Query('recorded_date') recordedDate?: string,
    @Query('latest_on_date') latestOnDate?: string,
  ) {
    const tenantId = req.tenantId;
    if (trend === 'true') {
      const trendData = await this.vitalsService.getPatientVitalTrends(patientId, tenantId, Number(limit) || 30);
      return trendData;
    }
    const vitals = await this.vitalsService.getByPatient(patientId, tenantId, {
      limit: Number(limit) || 100,
      recordedDate,
      latestOnDate: latestOnDate === 'true',
    });
    return { vitals, total: vitals.length };
  }
}
