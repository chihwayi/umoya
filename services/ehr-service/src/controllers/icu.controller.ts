import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { IcuService } from '../services/icu.service';

@Controller('icu')
export class IcuController {
  constructor(private readonly svc: IcuService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('patient/:patientId/admission')
  addAdmission(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addAdmission(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/admission')
  getAdmissions(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getAdmissions(this.tenant(h), patientId);
  }

  @Patch('admission/:id')
  updateAdmission(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateAdmission(this.tenant(h), id, dto);
  }

  @Post('patient/:patientId/sofa')
  addSofa(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSofa(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/sofa')
  getSofa(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getSofaScores(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/vent')
  addVent(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addVentSettings(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/vent')
  getVent(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getVentSettings(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/sedation')
  addSedation(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addSedation(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/sedation')
  getSedation(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getSedation(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/line')
  addLine(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addLine(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/line')
  getLines(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getLines(this.tenant(h), patientId);
  }

  @Patch('line/:id')
  updateLine(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateLine(this.tenant(h), id, dto);
  }

  @Post('patient/:patientId/vasopressor')
  addVasopressor(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addVasopressor(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/vasopressor')
  getVasopressors(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getVasopressors(this.tenant(h), patientId);
  }

  @Patch('vasopressor/:id')
  updateVasopressor(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateVasopressor(this.tenant(h), id, dto);
  }

  @Post('cdss/sofa/calculate')
  cdssSofa(@Body() body: any) { return this.svc.calculateSofa(body); }

  @Post('cdss/vent/protocol')
  cdssVent(@Body() body: any) { return this.svc.ventProtocol(body); }

  @Post('cdss/sedation/assess')
  cdssSedation(@Body() body: any) { return this.svc.assessSedation(body); }
}
