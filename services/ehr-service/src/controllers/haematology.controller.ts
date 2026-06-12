import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { HaematologyService } from '../services/haematology.service';

@Controller('haematology')
@UseGuards(JwtAuthGuard)
export class HaematologyController {
  constructor(private readonly haemSvc: HaematologyService) {}

  @Post('patient/:patientId/register')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.haemSvc.enroll(req.tenantId!, { ...body, patientId, registeredBy: req.user?.sub || req.user?.id });
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.haemSvc.getRegister(req.tenantId!, patientId);
  }

  @Get()
  list(@Query('category') category?: string, @Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.haemSvc.listRegisters((req as any).tenantId!, { category, limit: limit ? Number(limit) : undefined });
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.haemSvc.updateRegister(req.tenantId!, id, body);
  }

  @Post('cdss/anaemia-workup')
  anaemiaWorkup(@Body() body: any) {
    return this.haemSvc.anaemiaWorkup(body);
  }

  @Post('cdss/transfusion-trigger')
  transfusionTrigger(@Body() body: any) {
    return this.haemSvc.transfusionTrigger(body);
  }

  @Post('cdss/lymphoma-staging')
  lymphomaStaging(@Body() body: any) {
    return this.haemSvc.lymphomaStaging(body);
  }
}
