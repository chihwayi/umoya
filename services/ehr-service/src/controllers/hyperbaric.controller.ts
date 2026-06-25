import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HyperbaricService } from '../services/hyperbaric.service';

@UseGuards(JwtAuthGuard)
@Controller('hbot')
export class HyperbaricController {
  constructor(private readonly svc: HyperbaricService) {}

  @Post('courses')
  createCourse(@Req() req: any, @Body() body: any) {
    return this.svc.createCourse(req.tenantDb, req.user.id, body);
  }

  @Get('courses/active')
  getActiveCourses(@Req() req: any) {
    return this.svc.getActiveCourses(req.tenantDb);
  }

  @Post('contraindication-screen')
  screenContraindications(
    @Req() req: any,
    @Body() body: {
      courseId: string;
      untreatedPneumothorax?: boolean; bleomycinUse?: boolean; cisplatinUse?: boolean;
      doxorubicinConcurrent?: boolean; disulfiramUse?: boolean; severeCopd?: boolean;
      claustrophobiaSevere?: boolean; pregnancy?: boolean; viralUrtiActive?: boolean;
    },
  ) {
    return this.svc.screenContraindications(req.tenantDb, req.user.id, body);
  }

  @Post('sessions')
  startSession(
    @Req() req: any,
    @Body() body: {
      courseId: string; chamberId: string; sessionNumber: number;
      preSpo2?: number; preBpSystolic?: number; preBpDiastolic?: number;
    },
  ) {
    return this.svc.startSession(req.tenantDb, req.user.id, body);
  }

  @Patch('sessions/:id/complete')
  completeSession(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { actualAta?: number; o2Pct?: number; airBreaks?: number; postSpo2?: number; earClearance?: string; notes?: string },
  ) {
    return this.svc.completeSession(req.tenantDb, id, body);
  }

  @Post('wound-progress')
  recordWoundProgress(@Req() req: any, @Body() body: any) {
    return this.svc.recordWoundProgress(req.tenantDb, req.user.id, body);
  }

  @Get('wound-progress/:courseId')
  getWoundTrend(@Req() req: any, @Param('courseId') courseId: string) {
    return this.svc.getWoundTrend(req.tenantDb, courseId);
  }

  @Patch('courses/:id/outcome')
  recordOutcome(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { outcome: string; status?: string },
  ) {
    return this.svc.recordOutcome(req.tenantDb, id, body);
  }
}
