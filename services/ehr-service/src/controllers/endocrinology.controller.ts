import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { EndocrinologyService } from '../services/endocrinology.service';

@Controller('endocrinology')
@UseGuards(JwtAuthGuard)
export class EndocrinologyController {
  constructor(private readonly endoSvc: EndocrinologyService) {}

  @Post('patient/:patientId/register')
  enroll(@Param('patientId') patientId: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.endoSvc.enroll(req.tenantId!, { ...body, patientId, registeredBy: req.user?.sub || req.user?.id });
  }

  @Get('patient/:patientId/register')
  getRegister(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.endoSvc.getRegister(req.tenantId!, patientId);
  }

  @Get()
  list(@Query('system') system?: string, @Query('limit') limit?: string, @Request() req?: RequestWithTenant) {
    return this.endoSvc.listRegisters((req as any).tenantId!, { system, limit: limit ? Number(limit) : undefined });
  }

  @Patch('register/:id')
  updateRegister(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithTenant) {
    return this.endoSvc.updateRegister(req.tenantId!, id, body);
  }

  @Post('cdss/thyroid')
  thyroidManagement(@Body() body: any) {
    return this.endoSvc.thyroidManagement(body);
  }

  @Post('cdss/adrenal-crisis')
  adrenalCrisis(@Body() body: any) {
    return this.endoSvc.adrenalCrisisProtocol(body);
  }

  @Post('cdss/levothyroxine-dose')
  levothyroxineDose(@Body() body: any) {
    return this.endoSvc.levothyroxineDose(body);
  }
}
