import { Controller, Get, Post, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { EducationPersonalizationService } from '../services/education-personalization.service';

@Controller('education')
export class EducationPersonalizationController {
  constructor(private readonly eduPersonal: EducationPersonalizationService) {}

  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/personalized')
  async getPersonalized(
    @Req() req: any,
    @Query('limit') limit?: string,
  ): Promise<unknown[]> {
    return this.eduPersonal.getPersonalizedCourses(
      req.patientId,
      req.tenantDb,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('clinician/recommend')
  async recommend(
    @Body() body: { patientId: string; courseId: string; note?: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.eduPersonal.recommendCourse(
      body.patientId,
      body.courseId,
      req.user.sub,
      body.note,
      req.tenantDb,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('courses/:courseId/diagnosis-map')
  async seedMap(
    @Param('courseId') courseId: string,
    @Body() body: { mappings: Array<{ icd10Code?: string; snomedCode?: string; weight?: number }> },
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.eduPersonal.seedDiagnosisMap(courseId, body.mappings, req.tenantDb);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/enrolment-stats')
  async enrolmentStats(
    @Param('courseId') courseId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.eduPersonal.getEnrolmentStats(courseId, req.tenantDb);
  }
}
