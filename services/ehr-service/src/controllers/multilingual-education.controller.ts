import { UseGuards, Controller, Post, Get, Patch, Body, Param, Req } from '@nestjs/common';
import { MultilingualEducationService } from '../services/multilingual-education.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Controller('education')
@UseGuards(JwtAuthGuard)
export class MultilingualEducationController {
  constructor(private readonly svc: MultilingualEducationService) {}

  @Post('generate')
  generate(
    @Req() req: RequestWithTenant,
    @Body('patientId') patientId: string,
    @Body('topic') topic: string,
    @Body('language') language: string,
    @Body('readingLevel') readingLevel?: number,
    @Body('encounterId') encounterId?: string,
  ) {
    return this.svc.generate(req.tenantDb!, req.tenantId!, patientId, topic, language, readingLevel, encounterId);
  }

  @Get('patient/:patientId')
  getMaterials(
    @Req() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.svc.getMaterials(req.tenantDb!, patientId);
  }

  @Patch(':id/delivered')
  markDelivered(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body('method') method: string,
  ) {
    return this.svc.markDelivered(req.tenantDb!, id, method);
  }
}
