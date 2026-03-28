import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { NutritionService } from '../services/nutrition.service';

@Controller('nutrition')
export class NutritionController {
  constructor(private readonly svc: NutritionService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('patient/:patientId/screening')
  addScreening(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addScreening(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/screening')
  getScreenings(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getScreenings(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/assessment')
  addAssessment(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addAssessment(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/assessment')
  getAssessments(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getAssessments(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/prescription')
  addPrescription(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addPrescription(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/prescription')
  getPrescriptions(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getPrescriptions(this.tenant(h), patientId);
  }

  @Patch('prescription/:id')
  updatePrescription(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updatePrescription(this.tenant(h), id, dto);
  }

  @Post('patient/:patientId/monitoring')
  addMonitoring(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addMonitoring(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/monitoring')
  getMonitoring(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getMonitoring(this.tenant(h), patientId);
  }

  @Post('cdss/screen')
  cdssScreen(@Body() body: any) { return this.svc.screenNutrition(body); }

  @Post('cdss/prescribe')
  cdssPrescribe(@Body() body: any) { return this.svc.prescribeNutrition(body); }

  @Post('cdss/refeeding-risk')
  cdssRefeeding(@Body() body: any) { return this.svc.refeedingRisk(body); }
}
