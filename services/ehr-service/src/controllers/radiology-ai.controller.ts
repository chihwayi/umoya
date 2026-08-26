import { UseGuards, Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { RadiologyAiService } from '../services/radiology-ai.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('radiology-ai')
@UseGuards(JwtAuthGuard)
export class RadiologyAiController {
  constructor(private readonly svc: RadiologyAiService) {}

  @Post('study')
  registerStudy(@Body() dto: any, @Query('subdomain') subdomain: string) {
    return this.svc.registerStudy(subdomain, dto);
  }

  @Get('study/:id')
  getStudy(@Param('id') id: string, @Query('subdomain') subdomain: string) {
    return this.svc.getStudy(subdomain, id);
  }

  @Get('patient/:patientId/studies')
  getStudies(@Param('patientId') patientId: string, @Query('subdomain') subdomain: string) {
    return this.svc.getStudiesForPatient(subdomain, patientId);
  }

  @Get('study/:id/findings')
  getFindingsForStudy(@Param('id') studyId: string, @Query('subdomain') subdomain: string) {
    return this.svc.getFindingsForStudy(subdomain, studyId);
  }

  @Get('patient/:patientId/findings')
  getFindingsForPatient(@Param('patientId') patientId: string, @Query('subdomain') subdomain: string) {
    return this.svc.getFindingsForPatient(subdomain, patientId);
  }

  @Patch('finding/:id/review')
  radiologistReview(
    @Param('id') id: string,
    @Query('subdomain') subdomain: string,
    @Body('notes') notes: string,
    @Body('reviewedBy') reviewedBy: string,
  ) {
    return this.svc.radiologistReview(subdomain, id, notes, reviewedBy);
  }
}
