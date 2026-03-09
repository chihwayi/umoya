import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { PracticeManagementService } from '../services/practice-management.service';

@ApiTags('Practice Management')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('practice-management')
export class PracticeManagementController {
  constructor(private readonly service: PracticeManagementService) {}

  // ==================== Fee schedules ====================

  @Get('fee-schedules')
  @ApiOperation({ summary: 'List fee schedules' })
  @ApiResponse({ status: 200 })
  listFeeSchedules(@Req() req: RequestWithTenant) {
    return this.service.listFeeSchedules(req.tenantDb);
  }

  @Post('fee-schedules')
  @ApiOperation({ summary: 'Create fee schedule' })
  @ApiResponse({ status: 201 })
  createFeeSchedule(@Body() body: any, @Req() req: RequestWithTenant) {
    return this.service.createFeeSchedule(body, req.tenantDb);
  }

  @Put('fee-schedules/:id')
  @ApiOperation({ summary: 'Update fee schedule' })
  @ApiResponse({ status: 200 })
  updateFeeSchedule(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    return this.service.updateFeeSchedule(id, body, req.tenantDb);
  }

  @Delete('fee-schedules/:id')
  @ApiOperation({ summary: 'Delete fee schedule' })
  @ApiResponse({ status: 200 })
  deleteFeeSchedule(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.service.deleteFeeSchedule(id, req.tenantDb);
  }

  @Get('fee-schedules/:id/items')
  @ApiOperation({ summary: 'List fee schedule items' })
  @ApiResponse({ status: 200 })
  listFeeScheduleItems(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.service.listFeeScheduleItems(id, req.tenantDb);
  }

  @Post('fee-schedules/:id/items')
  @ApiOperation({ summary: 'Add fee schedule item' })
  @ApiResponse({ status: 201 })
  addFeeScheduleItem(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    return this.service.addFeeScheduleItem(id, body, req.tenantDb);
  }

  @Delete('fee-schedule-items/:id')
  @ApiOperation({ summary: 'Delete fee schedule item' })
  @ApiResponse({ status: 200 })
  deleteFeeScheduleItem(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.service.deleteFeeScheduleItem(id, req.tenantDb);
  }

  // ==================== Superbill templates ====================

  @Get('superbill-templates')
  @ApiOperation({ summary: 'List superbill templates' })
  @ApiResponse({ status: 200 })
  listSuperbillTemplates(@Req() req: RequestWithTenant) {
    return this.service.listSuperbillTemplates(req.tenantDb);
  }

  @Post('superbill-templates')
  @ApiOperation({ summary: 'Create superbill template' })
  @ApiResponse({ status: 201 })
  createSuperbillTemplate(@Body() body: any, @Req() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.service.createSuperbillTemplate(body, userId, req.tenantDb);
  }

  @Put('superbill-templates/:id')
  @ApiOperation({ summary: 'Update superbill template' })
  @ApiResponse({ status: 200 })
  updateSuperbillTemplate(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    return this.service.updateSuperbillTemplate(id, body, req.tenantDb);
  }

  @Delete('superbill-templates/:id')
  @ApiOperation({ summary: 'Delete superbill template' })
  @ApiResponse({ status: 200 })
  deleteSuperbillTemplate(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.service.deleteSuperbillTemplate(id, req.tenantDb);
  }

  // ==================== Insurance verification ====================

  @Get('insurance-verifications')
  @ApiOperation({ summary: 'List insurance verifications' })
  @ApiResponse({ status: 200 })
  listInsuranceVerifications(
    @Query('patientId') patientId: string | undefined,
    @Query('appointmentId') appointmentId: string | undefined,
    @Query('status') status: string | undefined,
    @Req() req: RequestWithTenant,
  ) {
    return this.service.listInsuranceVerifications(req.tenantDb, { patientId, appointmentId, status });
  }

  @Post('insurance-verifications')
  @ApiOperation({ summary: 'Create insurance verification' })
  @ApiResponse({ status: 201 })
  createInsuranceVerification(@Body() body: any, @Req() req: RequestWithTenant) {
    return this.service.createInsuranceVerification(body, req.tenantDb);
  }

  @Put('insurance-verifications/:id')
  @ApiOperation({ summary: 'Update insurance verification' })
  @ApiResponse({ status: 200 })
  updateInsuranceVerification(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    return this.service.updateInsuranceVerification(id, body, req.tenantDb);
  }

  @Post('insurance-verifications/:id/mark')
  @ApiOperation({ summary: 'Mark insurance verification (verified/denied/expired/not_found)' })
  @ApiResponse({ status: 200 })
  markInsuranceVerification(
    @Param('id') id: string,
    @Body() body: { status: 'verified' | 'denied' | 'expired' | 'not_found'; notes?: string },
    @Req() req: RequestWithTenant,
  ) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id ?? null;
    return this.service.markInsuranceVerification(id, body.status, userId, req.tenantDb, body.notes);
  }
}

