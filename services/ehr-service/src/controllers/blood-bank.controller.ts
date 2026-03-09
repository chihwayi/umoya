import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { BloodBankService } from '../services/blood-bank.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Blood Bank')
@ApiBearerAuth()
@Controller('blood-bank')
@UseGuards(JwtAuthGuard)
export class BloodBankController {
  constructor(
    private readonly bloodBankService: BloodBankService,
    private readonly tenantService: TenantService,
  ) {}

  // ==================== DONORS ====================

  @Post('donors')
  @ApiOperation({ summary: 'Register blood donor' })
  @ApiResponse({ status: 201, description: 'Donor registered' })
  async registerDonor(
    @Body() donorData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.registerDonor(donorData, tenantDb);
  }

  @Get('donors')
  @ApiOperation({ summary: 'Get blood donors' })
  @ApiResponse({ status: 200, description: 'Donors retrieved' })
  async getDonors(
    @Query('bloodGroup') bloodGroup: string,
    @Query('status') status: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const filters: any = {};
    if (bloodGroup) filters.bloodGroup = bloodGroup;
    if (status) filters.donorStatus = status;
    return this.bloodBankService.getDonors(filters, tenantDb);
  }

  // ==================== INVENTORY ====================

  @Get('inventory')
  @ApiOperation({ summary: 'Get blood inventory' })
  @ApiResponse({ status: 200, description: 'Inventory retrieved' })
  async getInventory(
    @Query('componentType') componentType: string,
    @Query('bloodGroup') bloodGroup: string,
    @Query('status') status: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const filters: any = {};
    if (componentType) filters.componentType = componentType;
    if (bloodGroup) filters.bloodGroup = bloodGroup;
    if (status) filters.status = status;
    return this.bloodBankService.getInventory(filters, tenantDb);
  }

  @Get('inventory/stats')
  @ApiOperation({ summary: 'Get blood inventory statistics' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getInventoryStats(
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.getInventoryStats(tenantDb);
  }

  @Post('inventory/:id/reserve')
  @ApiOperation({ summary: 'Reserve blood unit for patient' })
  @ApiResponse({ status: 200, description: 'Unit reserved' })
  async reserveUnit(
    @Param('id') id: string,
    @Body() data: { patientId: string },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.reserveUnit(id, data.patientId, tenantDb);
  }

  // ==================== TRANSFUSIONS ====================

  @Post('transfusions')
  @ApiOperation({ summary: 'Order blood transfusion' })
  @ApiResponse({ status: 201, description: 'Transfusion ordered' })
  async orderTransfusion(
    @Body() transfusionData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.orderTransfusion(transfusionData, req.user?.userId ?? (req.user as any)?.id, tenantDb);
  }

  @Post('transfusions/:id/start')
  @ApiOperation({ summary: 'Start blood transfusion' })
  @ApiResponse({ status: 200, description: 'Transfusion started' })
  async startTransfusion(
    @Param('id') id: string,
    @Body() data: { preVitals: any },
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.startTransfusion(id, req.user?.userId ?? (req.user as any)?.id, data.preVitals, tenantDb);
  }

  @Post('transfusions/:id/vitals')
  @ApiOperation({ summary: 'Record transfusion vitals' })
  @ApiResponse({ status: 200, description: 'Vitals recorded' })
  async recordTransfusionVitals(
    @Param('id') id: string,
    @Body() vitals: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.recordTransfusionVitals(id, vitals, tenantDb);
  }

  @Post('transfusions/:id/complete')
  @ApiOperation({ summary: 'Complete blood transfusion' })
  @ApiResponse({ status: 200, description: 'Transfusion completed' })
  async completeTransfusion(
    @Param('id') id: string,
    @Body() completionData: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.completeTransfusion(id, completionData, tenantDb);
  }

  @Get('transfusions/active')
  @ApiOperation({ summary: 'Get active transfusions' })
  @ApiResponse({ status: 200, description: 'Active transfusions retrieved' })
  async getActiveTransfusions(
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.getActiveTransfusions(tenantDb);
  }

  @Post('type-and-screen')
  @ApiOperation({ summary: 'Type and screen for patient' })
  async typeAndScreen(@Body() body: { patientId: string; bloodGroup: string; rhFactor: string; antibodyScreen?: string }, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bloodBankService.typeAndScreen(body.patientId, body, userId, tenantDb);
  }

  @Post('crossmatch')
  @ApiOperation({ summary: 'Perform crossmatch' })
  async performCrossmatch(@Body() body: { patientId: string; inventoryId: string; majorCrossMatch?: string; minorCrossMatch?: string }, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bloodBankService.performCrossmatch(body, userId, tenantDb);
  }

  @Get('crossmatch/patient/:patientId')
  @ApiOperation({ summary: 'Get patient crossmatch history' })
  async getCrossmatchByPatient(@Param('patientId') patientId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.getCrossmatchByPatient(patientId, tenantDb);
  }

  @Post('transfusions/:id/reaction')
  @ApiOperation({ summary: 'Report transfusion reaction' })
  async reportTransfusionReaction(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bloodBankService.reportTransfusionReaction(id, body, userId, tenantDb);
  }

  @Get('transfusions/:id/reaction')
  @ApiOperation({ summary: 'Get transfusion reaction details' })
  async getTransfusionReactions(@Param('id') id: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return this.bloodBankService.getTransfusionReactions(id, tenantDb);
  }

  @Post('massive-transfusion-protocol')
  @ApiOperation({ summary: 'Activate massive transfusion protocol' })
  async activateMTP(@Body() body: { patientId: string; unitsRequested?: number; indication?: string }, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const userId = req.user?.userId ?? (req.user as any)?.id;
    return this.bloodBankService.activateMassiveTransfusionProtocol(body.patientId, body, userId, tenantDb);
  }

  @Get('utilization-report')
  @ApiOperation({ summary: 'Blood utilization metrics' })
  async getUtilizationReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.bloodBankService.getUtilizationReport(tenantDb, start, end);
  }
}

