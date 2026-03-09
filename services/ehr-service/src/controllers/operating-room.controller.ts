import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { OperatingRoomService } from '../services/operating-room.service';
import { TenantService } from '../services/tenant.service';

@ApiTags('Operating Room')
@ApiBearerAuth()
@Controller('operating-room')
@UseGuards(JwtAuthGuard)
export class OperatingRoomController {
  constructor(
    private readonly orService: OperatingRoomService,
    private readonly tenantService: TenantService,
  ) {}

  @Get('rooms')
  @ApiOperation({ summary: 'Get all operating rooms' })
  async getOperatingRooms(@Query() filters: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getOperatingRooms(filters, tenantDb);
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Get operating room by ID' })
  async getORById(@Param('id') orId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getORById(orId, tenantDb);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Get OR availability for a date' })
  async getORAvailability(@Query('date') date: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const dateObj = date ? new Date(date) : new Date();
    return await this.orService.getORAvailability(dateObj, tenantDb);
  }

  @Post('cases')
  @ApiOperation({ summary: 'Schedule a surgical case' })
  async scheduleSurgicalCase(@Body() caseData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.scheduleSurgicalCase(caseData, req.user.userId, tenantDb);
  }

  @Get('cases')
  @ApiOperation({ summary: 'Get surgical cases by date' })
  async getSurgicalCases(@Query('date') date: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const dateObj = date ? new Date(date) : new Date();
    return await this.orService.getSurgicalCasesByDate(dateObj, tenantDb);
  }

  @Get('cases/:id')
  @ApiOperation({ summary: 'Get surgical case by ID' })
  async getSurgicalCase(@Param('id') caseId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getSurgicalCase(caseId, tenantDb);
  }

  @Put('cases/:id/status')
  @ApiOperation({ summary: 'Update case status' })
  @HttpCode(HttpStatus.OK)
  async updateCaseStatus(
    @Param('id') caseId: string,
    @Body('status') status: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.updateCaseStatus(caseId, status, req.user.userId, tenantDb);
  }

  @Put('cases/:id/documentation')
  @ApiOperation({ summary: 'Update case documentation' })
  @HttpCode(HttpStatus.OK)
  async updateCaseDocumentation(
    @Param('id') caseId: string,
    @Body() documentation: any,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.updateCaseDocumentation(caseId, documentation, req.user.userId, tenantDb);
  }

  @Post('cases/:id/cancel')
  @ApiOperation({ summary: 'Cancel surgical case' })
  @HttpCode(HttpStatus.OK)
  async cancelCase(
    @Param('id') caseId: string,
    @Body('reason') reason: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.cancelCase(caseId, reason, req.user.userId, tenantDb);
  }

  @Post('implants')
  @ApiOperation({ summary: 'Track surgical implant' })
  async trackImplant(@Body() implantData: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.trackImplant(implantData, req.user.userId, tenantDb);
  }

  @Get('implants/case/:caseId')
  @ApiOperation({ summary: 'Get implants for a case' })
  async getCaseImplants(@Param('caseId') caseId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getCaseImplants(caseId, tenantDb);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get OR metrics' })
  async getORMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: RequestWithTenant,
  ) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    return await this.orService.getORMetrics(start, end, tenantDb);
  }

  @Get('cases/:id/safety-checklist')
  @ApiOperation({ summary: 'Get WHO safety checklist for case' })
  async getSafetyChecklist(@Param('id') caseId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getSafetyChecklist(caseId, tenantDb);
  }

  @Post('cases/:id/safety-checklist/sign-in')
  @ApiOperation({ summary: 'Complete Sign In (before anesthesia)' })
  @HttpCode(HttpStatus.OK)
  async safetyChecklistSignIn(@Param('id') caseId: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.updateSafetyChecklistSignIn(caseId, body, req.user.userId, tenantDb);
  }

  @Post('cases/:id/safety-checklist/time-out')
  @ApiOperation({ summary: 'Complete Time Out (before skin incision)' })
  @HttpCode(HttpStatus.OK)
  async safetyChecklistTimeOut(@Param('id') caseId: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.updateSafetyChecklistTimeOut(caseId, body, req.user.userId, tenantDb);
  }

  @Post('cases/:id/safety-checklist/sign-out')
  @ApiOperation({ summary: 'Complete Sign Out (before patient leaves OR)' })
  @HttpCode(HttpStatus.OK)
  async safetyChecklistSignOut(@Param('id') caseId: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.updateSafetyChecklistSignOut(caseId, body, req.user.userId, tenantDb);
  }

  @Get('cases/:id/count-sheets')
  @ApiOperation({ summary: 'Get count sheets for case' })
  async getCountSheets(@Param('id') caseId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getCountSheets(caseId, tenantDb);
  }

  @Post('cases/:id/count-sheets')
  @ApiOperation({ summary: 'Add count sheet item' })
  async addCountSheet(@Param('id') caseId: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.addCountSheet(caseId, body, req.user.userId, tenantDb);
  }

  @Put('count-sheets/:id/verify')
  @ApiOperation({ summary: 'Verify count (final count)' })
  async verifyCountSheet(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.verifyCountSheet(id, body, req.user.userId, tenantDb);
  }

  @Get('cases/:id/specimens')
  @ApiOperation({ summary: 'Get specimens for case' })
  async getSpecimens(@Param('id') caseId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getSpecimens(caseId, tenantDb);
  }

  @Post('cases/:id/specimens')
  @ApiOperation({ summary: 'Add specimen' })
  async addSpecimen(@Param('id') caseId: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.addSpecimen(caseId, body, req.user.userId, tenantDb);
  }

  @Get('preference-cards')
  @ApiOperation({ summary: 'Get all preference cards' })
  async getPreferenceCards(@Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getPreferenceCards(tenantDb);
  }

  @Get('preference-cards/surgeon/:surgeonId')
  @ApiOperation({ summary: 'Get preference cards by surgeon' })
  async getPreferenceCardsBySurgeon(@Param('surgeonId') surgeonId: string, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.getPreferenceCardsBySurgeon(surgeonId, tenantDb);
  }

  @Post('preference-cards')
  @ApiOperation({ summary: 'Create preference card' })
  async createPreferenceCard(@Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.createPreferenceCard(body, req.user.userId, tenantDb);
  }

  @Put('preference-cards/:id')
  @ApiOperation({ summary: 'Update preference card' })
  async updatePreferenceCard(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithTenant) {
    const tenantDb = await this.tenantService.getTenantDatabase(req.tenantId);
    return await this.orService.updatePreferenceCard(id, body, tenantDb);
  }
}

