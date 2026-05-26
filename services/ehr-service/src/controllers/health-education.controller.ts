import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HealthEducatorGuard } from '../guards/health-educator.guard';
import { HealthEducationService } from '../services/health-education.service';

@Controller('health-education')
@UseGuards(JwtAuthGuard, HealthEducatorGuard)
export class HealthEducationController {
  constructor(private readonly edu: HealthEducationService) {}

  @Get('courses')
  listCourses(@Req() req) {
    return this.edu.listCourses(req.tenantDb);
  }

  @Get('courses/:id')
  getCourse(@Param('id') id: string, @Req() req) {
    return this.edu.getCourse(id, req.tenantDb);
  }

  @Get('courses/:courseId/modules')
  getModules(@Param('courseId') courseId: string, @Req() req) {
    return this.edu.getModules(courseId, req.tenantDb);
  }

  @Post('modules/:moduleId/reorder')
  reorderModule(@Param('moduleId') moduleId: string, @Body() body, @Req() req) {
    return this.edu.reorderModule(moduleId, body.direction, req.tenantDb);
  }

  @Post('courses')
  createCourse(@Body() dto, @Req() req) {
    return this.edu.createCourse(dto, req.user.sub, req.tenantDb);
  }

  @Patch('courses/:id')
  updateCourse(@Param('id') id: string, @Body() dto, @Req() req) {
    return this.edu.updateCourse(id, dto, req.tenantDb);
  }

  @Post('courses/:id/publish')
  publishCourse(@Param('id') id: string, @Req() req) {
    return this.edu.publishCourse(id, req.tenantDb);
  }

  @Post('courses/:id/unpublish')
  unpublishCourse(@Param('id') id: string, @Req() req) {
    return this.edu.unpublishCourse(id, req.tenantDb);
  }

  @Post('courses/:courseId/modules')
  addModule(@Param('courseId') courseId: string, @Body() body, @Req() req) {
    return this.edu.addModule(courseId, body.title, req.tenantDb);
  }

  @Post('modules/:moduleId/lessons')
  addLesson(@Param('moduleId') moduleId: string, @Body() dto, @Req() req) {
    return this.edu.addLesson(moduleId, dto, req.tenantDb);
  }

  @Post('lessons/:lessonId/translations')
  upsertTranslation(@Param('lessonId') lessonId: string, @Body() dto, @Req() req) {
    return this.edu.upsertTranslation(lessonId, dto, req.tenantDb);
  }

  @Post('lessons/:lessonId/quiz')
  createQuiz(@Param('lessonId') lessonId: string, @Body() body, @Req() req) {
    return this.edu.createQuiz(lessonId, body.passThreshold ?? 70, body.maxAttempts ?? 3, req.tenantDb);
  }

  @Post('quizzes/:quizId/questions')
  addQuestion(@Param('quizId') quizId: string, @Body() body, @Req() req) {
    return this.edu.addQuestion(quizId, body.questionText, body.options, req.tenantDb);
  }

  @Post('courses/:courseId/assign/:patientId')
  assignToPatient(@Param('courseId') courseId: string, @Param('patientId') patientId: string, @Req() req) {
    return this.edu.assignToPatient(courseId, patientId, req.user.sub, req.tenantDb);
  }

  @Post('courses/:courseId/assign-all')
  assignToAll(@Param('courseId') courseId: string, @Req() req) {
    return this.edu.assignToAll(courseId, req.user.sub, req.tenantDb);
  }

  @Get('courses/:courseId/progress')
  getCourseProgress(@Param('courseId') courseId: string, @Req() req) {
    return this.edu.getCourseProgress(courseId, req.tenantDb);
  }
}
