import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ReferralService } from '../services/referral.service';
import { ReferralTemplateService } from '../services/referral-template.service';
import { ReferralFacilityService } from '../services/referral-facility.service';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly referralTemplateService: ReferralTemplateService,
    private readonly referralFacilityService: ReferralFacilityService,
  ) {}

  // ==================== REFERRAL MANAGEMENT ====================

  @Post()
  @ApiOperation({ summary: 'Create a new referral' })
  @ApiResponse({ status: 201, description: 'Referral created successfully' })
  async createReferral(
    @Body() body: { patientId: string; referralData: any },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.createReferral(
      body.patientId,
      body.referralData,
      req.user.sub,
      req.tenantDb,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all referrals with filters' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'referringProviderId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'referralType', required: false })
  @ApiQuery({ name: 'specialty', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Referrals retrieved successfully' })
  async getReferrals(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralService.getReferrals(filters, req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get referral by ID' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Referral not found' })
  async getReferralById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralById(id, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral updated successfully' })
  async updateReferral(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.updateReferral(id, updates, req.user.sub, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral deleted successfully' })
  async deleteReferral(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.deleteReferral(id, req.tenantDb);
  }

  // ==================== REFERRAL ACTIONS ====================

  @Post(':id/send')
  @ApiOperation({ summary: 'Send a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral sent successfully' })
  async sendReferral(
    @Param('id') id: string,
    @Body() body: { method: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.sendReferral(id, body.method, req.user.sub, req.tenantDb);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge receipt of referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral acknowledged successfully' })
  async acknowledgeReferral(
    @Param('id') id: string,
    @Body() responseData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.acknowledgeReferral(id, responseData, req.user.sub, req.tenantDb);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule appointment for referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Appointment scheduled successfully' })
  async scheduleAppointment(
    @Param('id') id: string,
    @Body() appointmentData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.scheduleAppointment(id, appointmentData, req.user.sub, req.tenantDb);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral completed successfully' })
  async completeReferral(
    @Param('id') id: string,
    @Body() outcomeData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.completeReferral(id, outcomeData, req.user.sub, req.tenantDb);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral cancelled successfully' })
  async cancelReferral(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.cancelReferral(id, body.reason, req.user.sub, req.tenantDb);
  }

  @Get(':id/status-history')
  @ApiOperation({ summary: 'Get referral status history' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Status history retrieved successfully' })
  async getReferralStatusHistory(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralStatusHistory(id, req.tenantDb);
  }

  // ==================== REFERRAL ATTACHMENTS ====================

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Add attachment to referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 201, description: 'Attachment added successfully' })
  async addAttachment(
    @Param('id') id: string,
    @Body() attachmentData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.addAttachment(id, attachmentData, req.user.sub, req.tenantDb);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Get referral attachments' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Attachments retrieved successfully' })
  async getReferralAttachments(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralAttachments(id, req.tenantDb);
  }

  @Delete(':id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID' })
  @ApiResponse({ status: 200, description: 'Attachment deleted successfully' })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralService.deleteAttachment(attachmentId, req.tenantDb);
  }

  // ==================== REFERRAL TEMPLATES ====================

  @Get('templates/list')
  @ApiOperation({ summary: 'Get all referral templates' })
  @ApiQuery({ name: 'referralType', required: false })
  @ApiQuery({ name: 'specialty', required: false })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralTemplateService.getTemplates(filters, req.tenantDb);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  async getTemplateById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralTemplateService.getTemplateById(id, req.tenantDb);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new referral template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @Body() templateData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralTemplateService.createTemplate(templateData, req.user.sub, req.tenantDb);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralTemplateService.updateTemplate(id, updates, req.tenantDb);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralTemplateService.deleteTemplate(id, req.tenantDb);
  }

  @Post('templates/:id/apply')
  @ApiOperation({ summary: 'Apply a template to create a referral' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 201, description: 'Referral created from template' })
  async applyTemplate(
    @Param('id') id: string,
    @Body() body: { patientId: string; customizations: any },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralTemplateService.applyTemplate(
      id,
      body.patientId,
      body.customizations,
      req.user.sub,
      req.tenantDb,
    );
  }

  // ==================== REFERRAL FACILITIES ====================

  @Get('facilities/list')
  @ApiOperation({ summary: 'Get all referral facilities' })
  @ApiQuery({ name: 'facilityType', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'acceptsInsurance', required: false })
  @ApiResponse({ status: 200, description: 'Facilities retrieved successfully' })
  async getFacilities(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.getFacilities(filters, req.tenantDb);
  }

  @Get('facilities/search')
  @ApiOperation({ summary: 'Search referral facilities' })
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'specialty', required: false })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchFacilities(
    @Query('query') query: string,
    @Query('specialty') specialty: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralFacilityService.searchFacilities(query, specialty, req.tenantDb);
  }

  @Get('facilities/specialties')
  @ApiOperation({ summary: 'Get all available specialties' })
  @ApiResponse({ status: 200, description: 'Specialties retrieved successfully' })
  async getSpecialties(@Req() req: RequestWithTenant) {
    return this.referralFacilityService.getSpecialties(req.tenantDb);
  }

  @Get('facilities/:id')
  @ApiOperation({ summary: 'Get facility by ID' })
  @ApiParam({ name: 'id', description: 'Facility ID' })
  @ApiResponse({ status: 200, description: 'Facility retrieved successfully' })
  async getFacilityById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.getFacilityById(id, req.tenantDb);
  }

  @Post('facilities')
  @ApiOperation({ summary: 'Add a new facility to directory' })
  @ApiResponse({ status: 201, description: 'Facility added successfully' })
  async addFacility(@Body() facilityData: any, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.addFacility(facilityData, req.tenantDb);
  }

  @Put('facilities/:id')
  @ApiOperation({ summary: 'Update a facility' })
  @ApiParam({ name: 'id', description: 'Facility ID' })
  @ApiResponse({ status: 200, description: 'Facility updated successfully' })
  async updateFacility(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralFacilityService.updateFacility(id, updates, req.tenantDb);
  }

  @Delete('facilities/:id')
  @ApiOperation({ summary: 'Delete a facility' })
  @ApiParam({ name: 'id', description: 'Facility ID' })
  @ApiResponse({ status: 200, description: 'Facility deleted successfully' })
  async deleteFacility(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.deleteFacility(id, req.tenantDb);
  }

  // ==================== REFERRAL ANALYTICS ====================

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get referral analytics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getReferralAnalytics(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralAnalytics(filters, req.tenantDb);
  }
}


  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { ReferralService } from '../services/referral.service';
import { ReferralTemplateService } from '../services/referral-template.service';
import { ReferralFacilityService } from '../services/referral-facility.service';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly referralTemplateService: ReferralTemplateService,
    private readonly referralFacilityService: ReferralFacilityService,
  ) {}

  // ==================== REFERRAL MANAGEMENT ====================

  @Post()
  @ApiOperation({ summary: 'Create a new referral' })
  @ApiResponse({ status: 201, description: 'Referral created successfully' })
  async createReferral(
    @Body() body: { patientId: string; referralData: any },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.createReferral(
      body.patientId,
      body.referralData,
      req.user.sub,
      req.tenantDb,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all referrals with filters' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'referringProviderId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'referralType', required: false })
  @ApiQuery({ name: 'specialty', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Referrals retrieved successfully' })
  async getReferrals(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralService.getReferrals(filters, req.tenantDb);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get referral by ID' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Referral not found' })
  async getReferralById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralById(id, req.tenantDb);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral updated successfully' })
  async updateReferral(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.updateReferral(id, updates, req.user.sub, req.tenantDb);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral deleted successfully' })
  async deleteReferral(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.deleteReferral(id, req.tenantDb);
  }

  // ==================== REFERRAL ACTIONS ====================

  @Post(':id/send')
  @ApiOperation({ summary: 'Send a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral sent successfully' })
  async sendReferral(
    @Param('id') id: string,
    @Body() body: { method: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.sendReferral(id, body.method, req.user.sub, req.tenantDb);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge receipt of referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral acknowledged successfully' })
  async acknowledgeReferral(
    @Param('id') id: string,
    @Body() responseData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.acknowledgeReferral(id, responseData, req.user.sub, req.tenantDb);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule appointment for referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Appointment scheduled successfully' })
  async scheduleAppointment(
    @Param('id') id: string,
    @Body() appointmentData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.scheduleAppointment(id, appointmentData, req.user.sub, req.tenantDb);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral completed successfully' })
  async completeReferral(
    @Param('id') id: string,
    @Body() outcomeData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.completeReferral(id, outcomeData, req.user.sub, req.tenantDb);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Referral cancelled successfully' })
  async cancelReferral(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.cancelReferral(id, body.reason, req.user.sub, req.tenantDb);
  }

  @Get(':id/status-history')
  @ApiOperation({ summary: 'Get referral status history' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Status history retrieved successfully' })
  async getReferralStatusHistory(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralStatusHistory(id, req.tenantDb);
  }

  // ==================== REFERRAL ATTACHMENTS ====================

  @Post(':id/attachments')
  @ApiOperation({ summary: 'Add attachment to referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 201, description: 'Attachment added successfully' })
  async addAttachment(
    @Param('id') id: string,
    @Body() attachmentData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralService.addAttachment(id, attachmentData, req.user.sub, req.tenantDb);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Get referral attachments' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiResponse({ status: 200, description: 'Attachments retrieved successfully' })
  async getReferralAttachments(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralAttachments(id, req.tenantDb);
  }

  @Delete(':id/attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment ID' })
  @ApiResponse({ status: 200, description: 'Attachment deleted successfully' })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralService.deleteAttachment(attachmentId, req.tenantDb);
  }

  // ==================== REFERRAL TEMPLATES ====================

  @Get('templates/list')
  @ApiOperation({ summary: 'Get all referral templates' })
  @ApiQuery({ name: 'referralType', required: false })
  @ApiQuery({ name: 'specialty', required: false })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async getTemplates(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralTemplateService.getTemplates(filters, req.tenantDb);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  async getTemplateById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralTemplateService.getTemplateById(id, req.tenantDb);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new referral template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @Body() templateData: any,
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralTemplateService.createTemplate(templateData, req.user.sub, req.tenantDb);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralTemplateService.updateTemplate(id, updates, req.tenantDb);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralTemplateService.deleteTemplate(id, req.tenantDb);
  }

  @Post('templates/:id/apply')
  @ApiOperation({ summary: 'Apply a template to create a referral' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 201, description: 'Referral created from template' })
  async applyTemplate(
    @Param('id') id: string,
    @Body() body: { patientId: string; customizations: any },
    @Req() req: RequestWithTenant & { user: any },
  ) {
    return this.referralTemplateService.applyTemplate(
      id,
      body.patientId,
      body.customizations,
      req.user.sub,
      req.tenantDb,
    );
  }

  // ==================== REFERRAL FACILITIES ====================

  @Get('facilities/list')
  @ApiOperation({ summary: 'Get all referral facilities' })
  @ApiQuery({ name: 'facilityType', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'acceptsInsurance', required: false })
  @ApiResponse({ status: 200, description: 'Facilities retrieved successfully' })
  async getFacilities(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.getFacilities(filters, req.tenantDb);
  }

  @Get('facilities/search')
  @ApiOperation({ summary: 'Search referral facilities' })
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'specialty', required: false })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchFacilities(
    @Query('query') query: string,
    @Query('specialty') specialty: string,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralFacilityService.searchFacilities(query, specialty, req.tenantDb);
  }

  @Get('facilities/specialties')
  @ApiOperation({ summary: 'Get all available specialties' })
  @ApiResponse({ status: 200, description: 'Specialties retrieved successfully' })
  async getSpecialties(@Req() req: RequestWithTenant) {
    return this.referralFacilityService.getSpecialties(req.tenantDb);
  }

  @Get('facilities/:id')
  @ApiOperation({ summary: 'Get facility by ID' })
  @ApiParam({ name: 'id', description: 'Facility ID' })
  @ApiResponse({ status: 200, description: 'Facility retrieved successfully' })
  async getFacilityById(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.getFacilityById(id, req.tenantDb);
  }

  @Post('facilities')
  @ApiOperation({ summary: 'Add a new facility to directory' })
  @ApiResponse({ status: 201, description: 'Facility added successfully' })
  async addFacility(@Body() facilityData: any, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.addFacility(facilityData, req.tenantDb);
  }

  @Put('facilities/:id')
  @ApiOperation({ summary: 'Update a facility' })
  @ApiParam({ name: 'id', description: 'Facility ID' })
  @ApiResponse({ status: 200, description: 'Facility updated successfully' })
  async updateFacility(
    @Param('id') id: string,
    @Body() updates: any,
    @Req() req: RequestWithTenant,
  ) {
    return this.referralFacilityService.updateFacility(id, updates, req.tenantDb);
  }

  @Delete('facilities/:id')
  @ApiOperation({ summary: 'Delete a facility' })
  @ApiParam({ name: 'id', description: 'Facility ID' })
  @ApiResponse({ status: 200, description: 'Facility deleted successfully' })
  async deleteFacility(@Param('id') id: string, @Req() req: RequestWithTenant) {
    return this.referralFacilityService.deleteFacility(id, req.tenantDb);
  }

  // ==================== REFERRAL ANALYTICS ====================

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get referral analytics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getReferralAnalytics(@Query() filters: any, @Req() req: RequestWithTenant) {
    return this.referralService.getReferralAnalytics(filters, req.tenantDb);
  }
}

