import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { VitalsService } from '../services/vitals.service';

@Controller('api/vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Post()
  async record(@Body() body: any, @Req() req: any) {
    const tenantId = req.tenantId;
    const saved = await this.vitalsService.recordVitals(body, tenantId);
    return { success: true, vitals: saved };
  }

  @Get('patient/:patientId')
  async getByPatient(@Param('patientId') patientId: string, @Req() req: any) {
    const tenantId = req.tenantId;
    const vitals = await this.vitalsService.getByPatient(patientId, tenantId);
    return { vitals, total: vitals.length };
  }
}


