import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmpowermentService } from '../services/empowerment.service';
import { SupportGroupsService } from '../services/support-groups.service';

@ApiTags('Empowerment')
@Controller('empowerment')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmpowermentController {
  constructor(
    private readonly empowermentSvc: EmpowermentService,
    private readonly sgSvc: SupportGroupsService,
  ) {}

  @Get('programmes')
  @ApiOperation({ summary: 'List WEEP/MEEP programmes' })
  listProgrammes(@Query('type') type: string, @Req() req: any) {
    const t = (type === 'WEEP' || type === 'MEEP') ? (type as 'WEEP' | 'MEEP') : null;
    return this.empowermentSvc.listProgrammes(t, req.tenantDb);
  }

  @Post('programmes')
  @ApiOperation({ summary: 'Create WEEP or MEEP programme' })
  createProgramme(@Body() body: any, @Req() req: any) {
    return this.empowermentSvc.createProgramme(body, req.tenantDb);
  }

  @Get('programmes/:id/stats')
  @ApiOperation({ summary: 'Get programme enrolment statistics' })
  getProgrammeStats(@Param('id') id: string, @Req() req: any) {
    return this.empowermentSvc.getProgrammeStats(id, req.tenantDb);
  }

  @Post('patients/:id/enrol')
  @ApiOperation({ summary: 'Enrol patient in WEEP/MEEP programme' })
  enrolPatient(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.empowermentSvc.enrolPatient({ ...body, patientId: id }, req.tenantDb);
  }

  @Patch('enrolments/:id')
  @ApiOperation({ summary: 'Update enrolment outcomes and status' })
  updateEnrolment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.empowermentSvc.updateEnrolmentOutcomes(id, body, req.tenantDb);
  }

  @Post('enrolments/:id/milestones')
  @ApiOperation({ summary: 'Add programme milestone for enrolment' })
  addMilestone(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.empowermentSvc.addMilestone(id, { ...body, recordedBy: req.user.sub }, req.tenantDb);
  }

  @Get('patients/:id/enrolments')
  @ApiOperation({ summary: 'Get all programme enrolments for patient' })
  getPatientEnrolments(@Param('id') id: string, @Req() req: any) {
    return this.empowermentSvc.getPatientEnrolments(id, req.tenantDb);
  }

  @Get('support-groups')
  @ApiOperation({ summary: 'List all active support groups with member counts' })
  listGroups(@Req() req: any) {
    return this.sgSvc.listGroups(req.tenantDb);
  }

  @Post('support-groups')
  @ApiOperation({ summary: 'Create support group' })
  createGroup(@Body() body: any, @Req() req: any) {
    return this.sgSvc.createGroup(body, req.tenantDb);
  }

  @Post('support-groups/:groupId/members/:patientId')
  @ApiOperation({ summary: 'Add patient to support group' })
  addMember(
    @Param('groupId') groupId: string,
    @Param('patientId') patientId: string,
    @Req() req: any,
  ) {
    return this.sgSvc.addMember(groupId, patientId, req.tenantDb);
  }

  @Patch('support-groups/:groupId/members/:patientId/remove')
  @ApiOperation({ summary: 'Remove patient from support group' })
  removeMember(
    @Param('groupId') gid: string,
    @Param('patientId') pid: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.sgSvc.removeMember(gid, pid, body.reason, req.tenantDb);
  }

  @Post('support-groups/:groupId/sessions')
  @ApiOperation({ summary: 'Record support group session' })
  createSession(@Param('groupId') groupId: string, @Body() body: any, @Req() req: any) {
    return this.sgSvc.createSession({ ...body, groupId, facilitatorId: req.user.sub }, req.tenantDb);
  }

  @Post('support-groups/sessions/:sessionId/attendance')
  @ApiOperation({ summary: 'Record attendance for a session' })
  recordAttendance(
    @Param('sessionId') sid: string,
    @Body() body: { attendees: Array<{ patientId: string; attended: boolean; absenceReason?: string }> },
    @Req() req: any,
  ) {
    return this.sgSvc.recordAttendance(sid, body.attendees, req.tenantDb);
  }

  @Get('patients/:id/groups')
  @ApiOperation({ summary: "Get patient's active support group memberships" })
  getPatientGroups(@Param('id') id: string, @Req() req: any) {
    return this.sgSvc.getPatientGroupMemberships(id, req.tenantDb);
  }

  @Get('support-groups/:groupId/attendance-stats')
  @ApiOperation({ summary: 'Get last 12 sessions attendance statistics for group' })
  getAttendanceStats(@Param('groupId') gid: string, @Req() req: any) {
    return this.sgSvc.getGroupAttendanceStats(gid, req.tenantDb);
  }
}
