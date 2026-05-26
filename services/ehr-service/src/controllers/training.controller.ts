import { Controller, Get, Post, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TrainingService } from '../services/training.service';

@ApiTags('Training')
@Controller('training')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrainingController {
  constructor(private readonly svc: TrainingService) {}

  @Get('courses')
  @ApiOperation({ summary: 'List all active training courses' })
  listCourses(@Req() req: any) {
    return this.svc.listCourses(req.tenantDb);
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Get course with modules' })
  getCourse(@Param('id') id: string, @Req() req: any) {
    return this.svc.getCourseWithModules(id, req.tenantDb);
  }

  @Get('trainees')
  @ApiOperation({ summary: 'Search trainees by name, facility, or email' })
  searchTrainees(@Query('q') q: string, @Req() req: any) {
    return this.svc.searchTrainees(q ?? '', req.tenantDb);
  }

  @Post('trainees')
  @ApiOperation({ summary: 'Register trainee (upsert by email)' })
  registerTrainee(@Body() body: any, @Req() req: any) {
    return this.svc.registerTrainee(body, req.tenantDb);
  }

  @Post('enrolments')
  @ApiOperation({ summary: 'Enrol trainee in a course' })
  enrolTrainee(@Body() body: any, @Req() req: any) {
    return this.svc.enrolTrainee({ ...body, enrolledBy: req.user.sub }, req.tenantDb);
  }

  @Get('courses/:courseId/cohort-report')
  @ApiOperation({ summary: 'Get cohort completion report for a course' })
  getCohortReport(
    @Param('courseId') cid: string,
    @Query('cohort') cohort: string,
    @Req() req: any,
  ) {
    return this.svc.getCohortReport(cid, cohort, req.tenantDb);
  }

  @Post('enrolments/:id/assessments')
  @ApiOperation({ summary: 'Submit MCQ assessment for an enrolment module' })
  submitAssessment(@Param('id') enrolmentId: string, @Body() body: any, @Req() req: any) {
    return this.svc.submitAssessment({ ...body, enrolmentId }, req.tenantDb);
  }

  @Post('enrolments/:id/complete')
  @ApiOperation({ summary: 'Mark enrolment complete — issues certificate if passed' })
  completeCourse(@Param('id') id: string, @Req() req: any) {
    return this.svc.completeCourse(id, req.tenantDb);
  }

  @Get('alumni/by-facility')
  @ApiOperation({ summary: 'Alumni counts aggregated by facility' })
  getAlumniByFacility(@Req() req: any) {
    return this.svc.getAlumniByFacility(req.tenantDb);
  }
}
