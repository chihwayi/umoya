import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { HivDisclosureService } from '../services/hiv-disclosure.service';
import { AlhivTransitionService } from '../services/alhiv-transition.service';
import { GbvService } from '../services/gbv.service';
import { CounsellorSessionsService } from '../services/counsellor-sessions.service';

@ApiTags('Psychosocial')
@Controller('psychosocial')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PsychosocialController {
  constructor(
    private readonly disclosureSvc: HivDisclosureService,
    private readonly transitionSvc: AlhivTransitionService,
    private readonly gbvSvc: GbvService,
    private readonly counsellorSvc: CounsellorSessionsService,
  ) {}

  @Get('patients/:id/disclosure')
  @ApiOperation({ summary: 'Get HIV disclosure history for patient' })
  getDisclosureHistory(@Param('id') id: string, @Req() req: any) {
    return this.disclosureSvc.getDisclosureHistory(id, req.tenantDb);
  }

  @Post('patients/:id/disclosure')
  @ApiOperation({ summary: 'Record HIV disclosure assessment' })
  createDisclosure(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.disclosureSvc.createDisclosureRecord({
      ...body,
      patientId: id,
      assessedBy: req.user.sub,
      db: req.tenantDb,
    });
  }

  @Get('patients/:id/transition')
  @ApiOperation({ summary: 'Get ALHIV transition assessment history' })
  getTransitionHistory(@Param('id') id: string, @Req() req: any) {
    return req.tenantDb.query(
      `SELECT * FROM alhiv_transition_assessments WHERE patient_id = $1 ORDER BY assessment_date DESC`,
      [id],
    );
  }

  @Post('patients/:id/transition')
  @ApiOperation({ summary: 'Create ALHIV transition readiness assessment' })
  createTransitionAssessment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.transitionSvc.createTransitionAssessment({
      ...body,
      patientId: id,
      assessedBy: req.user.sub,
      db: req.tenantDb,
    });
  }

  @Patch('transition/:assessmentId/mark-transferred')
  @ApiOperation({ summary: 'Mark ALHIV patient as transferred to adult services' })
  markTransferred(
    @Param('assessmentId') id: string,
    @Body() body: { transferDate: string },
    @Req() req: any,
  ) {
    return this.transitionSvc.markTransferred(id, body.transferDate, req.tenantDb);
  }

  @Get('patients/:id/gbv')
  @ApiOperation({ summary: 'Get GBV assessment history (restricted access)' })
  getGbvHistory(@Param('id') id: string, @Req() req: any) {
    return this.gbvSvc.getGbvHistory(id, req.tenantDb);
  }

  @Post('patients/:id/gbv')
  @ApiOperation({ summary: 'Record HITS GBV screening and safety plan' })
  createGbvAssessment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.gbvSvc.createGbvAssessment({
      ...body,
      patientId: id,
      screenedBy: req.user.sub,
      db: req.tenantDb,
    });
  }

  @Get('patients/:id/sessions')
  @ApiOperation({ summary: 'Get counsellor session records for patient' })
  getSessions(@Param('id') id: string, @Req() req: any) {
    const isCounsellor = req.user.role === 'counsellor';
    return this.counsellorSvc.getPatientSessions(
      id,
      isCounsellor ? req.user.sub : null,
      req.tenantDb,
    );
  }

  @Post('patients/:id/sessions')
  @ApiOperation({ summary: 'Record counsellor session' })
  createSession(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.counsellorSvc.createSession({
      ...body,
      patientId: id,
      counsellorId: req.user.sub,
      db: req.tenantDb,
    });
  }
}
