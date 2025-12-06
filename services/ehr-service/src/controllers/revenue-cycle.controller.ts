import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { RevenueCycleService } from '../services/revenue-cycle.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Revenue Cycle')
@ApiBearerAuth()
@Controller('revenue-cycle')
@UseGuards(JwtAuthGuard)
export class RevenueCycleController {
  constructor(
    private readonly revenueCycleService: RevenueCycleService,
    private readonly tenantService: TenantService,
  ) {}

  // ==================== CHARGE MASTER ====================

  @Get('charge-master')
  @ApiOperation({ summary: 'Get charge master items' })
  @ApiResponse({ status: 200, description: 'Charge master retrieved' })
  async getChargeMaster(
    @Query('department') department: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const filters: any = {};
    if (department) filters.department = department;
    return this.revenueCycleService.getChargeMaster(filters, tenantDb);
  }

  @Post('charge-master')
  @ApiOperation({ summary: 'Create charge master item' })
  @ApiResponse({ status: 201, description: 'Charge master item created' })
  async createChargeMasterItem(
    @Body() itemData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.createChargeMasterItem(itemData, tenantDb);
  }

  // ==================== PATIENT CHARGES ====================

  @Post('charges')
  @ApiOperation({ summary: 'Capture patient charge' })
  @ApiResponse({ status: 201, description: 'Charge captured' })
  async captureCharge(
    @Body() chargeData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.captureCharge(chargeData, req.user.id, tenantDb);
  }

  @Get('charges/patient/:patientId')
  @ApiOperation({ summary: 'Get patient charges' })
  @ApiResponse({ status: 200, description: 'Charges retrieved' })
  async getPatientCharges(
    @Param('patientId') patientId: string,
    @Query('admissionId') admissionId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.getPatientCharges(patientId, admissionId, tenantDb);
  }

  @Get('charges/patient/:patientId/total')
  @ApiOperation({ summary: 'Get total charges for patient' })
  @ApiResponse({ status: 200, description: 'Total charges calculated' })
  async getTotalCharges(
    @Param('patientId') patientId: string,
    @Query('admissionId') admissionId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const total = await this.revenueCycleService.getTotalCharges(patientId, admissionId, tenantDb);
    return { total };
  }

  // ==================== APPROVAL WORKFLOW ====================
  // IMPORTANT: More specific routes MUST come before parameterized routes
  // Order matters in NestJS routing!

  @Get('charges/pending-review')
  @ApiOperation({ summary: 'Get pending charges for doctor' })
  @ApiResponse({ status: 200, description: 'Pending charges retrieved' })
  async getPendingChargesForDoctor(
    @Query('doctorId') doctorId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = doctorId || req.user.id;
    return this.revenueCycleService.getPendingChargesForDoctor(userId, tenantDb);
  }

  @Get('charges/review/admission/:admissionId')
  @ApiOperation({ summary: 'Review charges for admission' })
  @ApiResponse({ status: 200, description: 'Charge review retrieved' })
  async reviewCharges(
    @Param('admissionId') admissionId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.reviewCharges(admissionId, tenantDb);
  }

  @Put('charges/admission/:admissionId/approve-all')
  @ApiOperation({ summary: 'Approve all charges for an admission' })
  @ApiResponse({ status: 200, description: 'All charges approved' })
  async approveAllChargesForAdmission(
    @Param('admissionId') admissionId: string,
    @Body() body: { notes?: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.approveAllChargesForAdmission(admissionId, req.user.id, body.notes || null, tenantDb);
  }

  @Post('charges/notify-accounts/:admissionId')
  @ApiOperation({ summary: 'Notify accounts department of approved charges' })
  @ApiResponse({ status: 201, description: 'Accounts notified' })
  async notifyAccounts(
    @Param('admissionId') admissionId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.notifyAccounts(admissionId, req.user.id, tenantDb);
  }

  // Parameterized routes come AFTER specific routes
  @Put('charges/:id/approve')
  @ApiOperation({ summary: 'Approve a charge' })
  @ApiResponse({ status: 200, description: 'Charge approved' })
  async approveCharge(
    @Param('id') chargeId: string,
    @Body() body: { notes?: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.approveCharge(chargeId, req.user.id, body.notes || null, tenantDb);
  }

  @Put('charges/:id/reject')
  @ApiOperation({ summary: 'Reject a charge' })
  @ApiResponse({ status: 200, description: 'Charge rejected' })
  async rejectCharge(
    @Param('id') chargeId: string,
    @Body() body: { reason: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    if (!body.reason) {
      throw new BadRequestException('Rejection reason is required');
    }
    return this.revenueCycleService.rejectCharge(chargeId, req.user.id, body.reason, tenantDb);
  }

  @Put('charges/:id/mark-reviewed')
  @ApiOperation({ summary: 'Mark charge as reviewed' })
  @ApiResponse({ status: 200, description: 'Charge reviewed' })
  async reviewCharge(
    @Param('id') chargeId: string,
    @Body() body: { notes?: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.reviewCharge(chargeId, req.user.id, body.notes || null, tenantDb);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get charge approval notifications for accounts' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved' })
  async getChargeNotifications(
    @Query('status') status: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.getChargeNotifications(req.user.id, status || null, tenantDb);
  }

  @Put('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markNotificationRead(
    @Param('id') notificationId: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.revenueCycleService.markNotificationRead(notificationId, req.user.id, tenantDb);
  }
}



