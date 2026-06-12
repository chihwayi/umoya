import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { UrologyService } from '../services/urology.service';

@Controller('urology')
@UseGuards(JwtAuthGuard)
export class UrologyController {
  constructor(private readonly uroSvc: UrologyService) {}

  @Post('patient/:patientId/register')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.uroSvc.enroll(req.tenantId!, { ...body, patientId, registeredBy: req.user?.sub || req.user?.id });
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.uroSvc.getRegister(req.tenantId!, patientId);
  }

  @Get()
  list(@Query('category') category?: string, @Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.uroSvc.listRegisters((req as any).tenantId!, { category, limit: limit ? Number(limit) : undefined });
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.uroSvc.updateRegister(req.tenantId!, id, body);
  }

  @Post('cdss/bph')
  bphManagement(@Body() body: any) {
    return this.uroSvc.bphManagement(body);
  }

  @Post('cdss/renal-stone')
  renalStoneManagement(@Body() body: any) {
    return this.uroSvc.renalStoneManagement(body);
  }

  @Post('cdss/psa')
  psaInterpretation(@Body() body: any) {
    return this.uroSvc.psaInterpretation(body);
  }
}
