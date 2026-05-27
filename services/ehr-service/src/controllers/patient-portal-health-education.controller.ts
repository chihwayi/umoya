import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { PatientHealthEducationService } from '../services/patient-health-education.service';

@Controller('patient-portal/education')
@UseGuards(PatientJwtAuthGuard)
export class PatientPortalHealthEducationController {
  constructor(private readonly edu: PatientHealthEducationService) {}

  @Get('courses')
  async getCourses(@Req() req, @Query('lang') lang: string) {
    const patientId = req.patientId;
    const language = lang ?? 'en';
    const [enrolled, browsable] = await Promise.all([
      this.edu.getMyCourses(patientId, language, req.tenantDb),
      this.edu.getBrowsableCourses(patientId, language, req.tenantDb),
    ]);
    return { enrolled, browsable };
  }

  @Get('courses/:courseId')
  getCourseContent(@Param('courseId') courseId: string, @Query('lang') lang: string, @Req() req) {
    return this.edu.getCourseContent(req.patientId, courseId, lang ?? 'en', req.tenantDb);
  }

  @Post('courses/:courseId/enroll')
  selfEnroll(@Param('courseId') courseId: string, @Req() req) {
    return this.edu.selfEnroll(req.patientId, courseId, req.tenantDb);
  }

  @Post('lessons/:lessonId/complete')
  markComplete(@Param('lessonId') lessonId: string, @Req() req) {
    return this.edu.markLessonComplete(req.patientId, lessonId, req.tenantDb);
  }

  @Post('quizzes/:quizId/attempt')
  submitAttempt(@Param('quizId') quizId: string, @Body() body, @Req() req) {
    return this.edu.submitQuizAttempt(req.patientId, quizId, body.answers, req.tenantDb);
  }
}
