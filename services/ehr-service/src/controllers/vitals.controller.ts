import { UseGuards, Controller, Post, Get, Body, Param, Req, Query, Logger } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { VitalsService } from '../services/vitals.service';
import { ProactiveAiService } from '../services/proactive-ai.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Vitals')
@Controller('vitals')
@UseGuards(JwtAuthGuard)
export class VitalsController {
  private readonly logger = new Logger(VitalsController.name);

  constructor(
    private readonly vitalsService: VitalsService,
    private readonly proactiveAiService: ProactiveAiService,
  ) {}

  @Post()
  async record(@Body() body: any, @Req() req: any) {
    const tenantId = req.tenantId;
    const saved = await this.vitalsService.recordVitals(body, tenantId);

    // ── PROACTIVE TRIGGER — pass fresh vitals so analysis doesn't re-fetch ──
    if (body.patientId) {
      this.proactiveAiService.triggerAnalysis({
        patientId: body.patientId,
        tenantId,
        triggeredByUserId: req.user?.userId,
        triggerType: 'vitals',
        freshVitals: {
          systolic_bp: body.systolicBp,
          diastolic_bp: body.diastolicBp,
          heart_rate: body.heartRate,
          temperature: body.temperature,
          oxygen_saturation: body.oxygenSaturation,
          respiratory_rate: body.respiratoryRate,
          glasgow_coma_scale: body.glasgowComaScale,
          blood_glucose: body.bloodGlucose,
        },
      }).catch((e: any) => this.logger.warn(`Vitals proactive analysis trigger failed: ${e?.message}`));
    }

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
