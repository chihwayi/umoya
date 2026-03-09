import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { CaseManagementService } from '../services/case-management.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Case Management')
@ApiBearerAuth()
@Controller('case-management')
@UseGuards(JwtAuthGuard)
export class CaseManagementController {
  constructor(
    private readonly caseManagementService: CaseManagementService,
    private readonly tenantService: TenantService,
  ) {}

  @Post('assessments')
  @ApiOperation({ summary: 'Create case management assessment' })
  @ApiResponse({ status: 201, description: 'Assessment created' })
  async createAssessment(
    @Body() assessmentData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.caseManagementService.createAssessment(assessmentData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Post('discharge-plans')
  @ApiOperation({ summary: 'Create discharge plan' })
  @ApiResponse({ status: 201, description: 'Discharge plan created' })
  async createDischargePlan(
    @Body() planData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.caseManagementService.createDischargePlan(planData, ((req.user as any)?.userId ?? (req.user as any)?.id), tenantDb);
  }

  @Get('discharge-plans/admission/:admissionId')
  @ApiOperation({ summary: 'Get discharge plan for admission' })
  @ApiResponse({ status: 200, description: 'Discharge plan retrieved' })
  async getDischargePlan(
    @Param('admissionId') admissionId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.caseManagementService.getDischargePlan(admissionId, tenantDb);
  }

  @Get('discharge-plans/pending')
  @ApiOperation({ summary: 'Get pending discharges' })
  @ApiResponse({ status: 200, description: 'Pending discharges retrieved' })
  async getPendingDischarges(
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.caseManagementService.getPendingDischarges(tenantDb);
  }
}




