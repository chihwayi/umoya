import { UseGuards, Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { DermatologyService } from '../services/dermatology.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('dermatology')
@UseGuards(JwtAuthGuard)
export class DermatologyController {
  constructor(private readonly svc: DermatologyService) {}

  @Post('patient/:patientId/lesion')
  addLesion(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addLesion(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/lesion')
  getLesions(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getLesions(req.tenantDb!, patientId);
  }

  @Patch('lesion/:id')
  updateLesion(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateLesion(req.tenantDb!, id, dto);
  }

  @Post('patient/:patientId/wound')
  addWound(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addWound(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/wound')
  getWounds(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getWounds(req.tenantDb!, patientId);
  }

  @Patch('wound/:id')
  updateWound(@Req() req: RequestWithTenant, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateWound(req.tenantDb!, id, dto);
  }

  @Post('patient/:patientId/burn')
  addBurn(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addBurn(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/burn')
  getBurns(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getBurns(req.tenantDb!, patientId);
  }

  @Post('patient/:patientId/note')
  addNote(@Req() req: RequestWithTenant, @Param('patientId') patientId: string, @Body() dto: any) {
    return this.svc.addNote(req.tenantDb!, { ...dto, patientId });
  }

  @Get('patient/:patientId/note')
  getNotes(@Req() req: RequestWithTenant, @Param('patientId') patientId: string) {
    return this.svc.getNotes(req.tenantDb!, patientId);
  }

  @Post('cdss/lesion/classify')
  classifyLesion(@Body() body: any) { return this.svc.classifyLesion(body); }

  @Post('cdss/burn/fluid')
  burnFluid(@Body() body: any) { return this.svc.calculateBurnFluid(body); }
}
