import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { MultilingualEducationService } from '../services/multilingual-education.service';

@Controller('education')
export class MultilingualEducationController {
  constructor(private readonly svc: MultilingualEducationService) {}

  @Post('generate')
  generate(
    @Body('subdomain') subdomain: string,
    @Body('patientId') patientId: string,
    @Body('topic') topic: string,
    @Body('language') language: string,
    @Body('readingLevel') readingLevel?: number,
    @Body('encounterId') encounterId?: string,
  ) {
    return this.svc.generate(subdomain, patientId, topic, language, readingLevel, encounterId);
  }

  @Get('patient/:patientId')
  getMaterials(
    @Param('patientId') patientId: string,
    @Query('subdomain') subdomain: string,
  ) {
    return this.svc.getMaterials(subdomain, patientId);
  }

  @Patch(':id/delivered')
  markDelivered(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body('method') method: string,
  ) {
    return this.svc.markDelivered(subdomain, id, method);
  }
}
