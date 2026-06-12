import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { GastroenterologyService } from '../services/gastroenterology.service';

@Controller('gastroenterology')
@UseGuards(JwtAuthGuard)
export class GastroenterologyController {
  constructor(private readonly gastroSvc: GastroenterologyService) {}

  @Post('patient/:patientId/register')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.gastroSvc.enroll(req.tenantId!, { ...body, patientId, registeredBy: req.user?.sub || req.user?.id });
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.gastroSvc.getRegister(req.tenantId!, patientId);
  }

  @Get()
  list(@Query('giRegion') giRegion?: string, @Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.gastroSvc.listRegisters((req as any).tenantId!, { giRegion, limit: limit ? Number(limit) : undefined });
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.gastroSvc.updateRegister(req.tenantId!, id, body);
  }

  @Post('patient/:patientId/endoscopy')
  recordEndoscopy(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.gastroSvc.recordEndoscopy(req.tenantId!, { ...body, patientId });
  }

  @Get('patient/:patientId/endoscopies')
  getEndoscopies(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.gastroSvc.getEndoscopies(req.tenantId!, patientId);
  }

  @Patch('endoscopy/:id')
  updateEndoscopy(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.gastroSvc.updateEndoscopy(req.tenantId!, id, body);
  }

  @Post('cdss/upper-gi-bleed-risk')
  upperGiBleedRisk(@Body() body: any) {
    return this.gastroSvc.upperGiBleedRisk(body);
  }

  @Post('cdss/cirrhosis-risk')
  cirrhosisRisk(@Body() body: any) {
    return this.gastroSvc.cirrhosisRisk(body);
  }

  @Post('cdss/dyspepsia')
  dyspepsiaGuidance(@Body() body: any) {
    return this.gastroSvc.dyspepsiaGuidance(body);
  }
}
