import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { FamilyPlanningService } from '../services/family-planning.service';
import { CdssService } from '../services/cdss.service';

@Controller('family-planning')
@UseGuards(JwtAuthGuard)
export class FamilyPlanningController {
  constructor(
    private readonly familyPlanningService: FamilyPlanningService,
    private readonly cdssService: CdssService,
  ) {}

  @Post('patient/:patientId/enroll')
  enroll(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.familyPlanningService.enroll(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      { ...body, patientId },
    );
  }

  @Get('patient/:patientId/enrollments')
  getEnrollments(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.familyPlanningService.getEnrollments(req.tenantId!, patientId);
  }

  @Get('patient/:patientId/active')
  getActiveEnrollment(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.familyPlanningService.getActiveEnrollment(req.tenantId!, patientId);
  }

  @Patch('enrollments/:id')
  updateEnrollment(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.familyPlanningService.updateEnrollment(req.tenantId!, id, body);
  }

  @Post('patient/:patientId/followups')
  recordFollowup(
    @Param('patientId') patientId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    return this.familyPlanningService.recordFollowup(
      req.tenantId!,
      req.user?.sub || req.user?.id || null,
      { ...body, patientId },
    );
  }

  @Get('patient/:patientId/followups')
  getFollowups(@Param('patientId') patientId: string, @Request() req: RequestWithTenant) {
    return this.familyPlanningService.getFollowups(req.tenantId!, patientId);
  }

  @Post('cdss/method-eligibility')
  getMethodEligibility(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.familyPlanningMethodEligibility(body, req.tenantId!);
  }

  @Post('cdss/method-counselling')
  methodCounselling(@Body() body: any) {
    return this.familyPlanningService.methodCounselling(body);
  }

  @Post('cdss/missed-method')
  missedMethod(@Body() body: any) {
    return this.familyPlanningService.missedMethodProtocol(body);
  }

  @Post('cdss/postpartum-contraception')
  postpartumContraception(@Body() body: any) {
    return this.familyPlanningService.postpartumContraception(body);
  }
}
