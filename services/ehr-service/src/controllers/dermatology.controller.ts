import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { DermatologyService } from '../services/dermatology.service';

@Controller('dermatology')
export class DermatologyController {
  constructor(private readonly svc: DermatologyService) {}

  private tenant(h: Record<string, string>): string {
    return h['x-tenant-subdomain'] || 'default';
  }

  @Post('patient/:patientId/lesion')
  addLesion(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addLesion(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/lesion')
  getLesions(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getLesions(this.tenant(h), patientId);
  }

  @Patch('lesion/:id')
  updateLesion(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateLesion(this.tenant(h), id, dto);
  }

  @Post('patient/:patientId/wound')
  addWound(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addWound(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/wound')
  getWounds(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getWounds(this.tenant(h), patientId);
  }

  @Patch('wound/:id')
  updateWound(@Headers() h: Record<string, string>, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateWound(this.tenant(h), id, dto);
  }

  @Post('patient/:patientId/burn')
  addBurn(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addBurn(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/burn')
  getBurns(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getBurns(this.tenant(h), patientId);
  }

  @Post('patient/:patientId/note')
  addNote(@Headers() h: Record<string, string>, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addNote(this.tenant(h), { ...dto, patientId });
  }

  @Get('patient/:patientId/note')
  getNotes(@Headers() h: Record<string, string>, @Param('patientId') patientId: string) {
    return this.svc.getNotes(this.tenant(h), patientId);
  }

  @Post('cdss/lesion/classify')
  classifyLesion(@Body() body: any) { return this.svc.classifyLesion(body); }

  @Post('cdss/burn/fluid')
  burnFluid(@Body() body: any) { return this.svc.calculateBurnFluid(body); }
}
