import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ImagingService } from '../services/imaging.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';

@ApiTags('Radiology & Medical Imaging')
@Controller('imaging')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ImagingController {
  constructor(private readonly imagingService: ImagingService) {}

  // ===== MODALITIES & STUDY TYPES =====

  @Get('modalities')
  @ApiOperation({ summary: 'Get all imaging modalities' })
  @ApiResponse({ status: 200, description: 'List of imaging modalities' })
  async getModalities(@Request() req: RequestWithTenant) {
    return this.imagingService.getModalities(req.tenantDb);
  }

  @Get('study-types')
  @ApiOperation({ summary: 'Get all study types' })
  @ApiResponse({ status: 200, description: 'List of study types' })
  async getStudyTypes(
    @Request() req: RequestWithTenant,
    @Query('modality') modalityCode?: string,
  ) {
    return this.imagingService.getStudyTypes(req.tenantDb, modalityCode);
  }

  @Get('study-types/:id')
  @ApiOperation({ summary: 'Get study type details' })
  @ApiResponse({ status: 200, description: 'Study type details' })
  async getStudyTypeById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.imagingService.getStudyTypeById(req.tenantDb, id);
  }

  // ===== ORDERS =====

  @Post('orders')
  @ApiOperation({ summary: 'Create imaging order' })
  @ApiResponse({ status: 201, description: 'Imaging order created successfully' })
  async createOrder(
    @Request() req: RequestWithTenant,
    @Body() orderData: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.createOrder(req.tenantDb, orderData, userId, req.tenantId);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get imaging orders' })
  @ApiResponse({ status: 200, description: 'List of imaging orders' })
  @Roles('radiologist', 'technologist', 'doctor', 'admin')
  async getOrders(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.imagingService.getOrders(req.tenantDb, { status, priority });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @Roles('radiologist', 'technologist', 'doctor', 'admin')
  async getOrderById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.imagingService.getOrderById(req.tenantDb, id);
  }

  @Get('orders/patient/:patientId')
  @ApiOperation({ summary: 'Get patient imaging orders' })
  @ApiResponse({ status: 200, description: 'Patient imaging orders' })
  @Roles('radiologist', 'technologist', 'doctor', 'admin')
  async getPatientOrders(
    @Request() req: RequestWithTenant,
    @Param('patientId') patientId: string,
  ) {
    return this.imagingService.getPatientOrders(req.tenantDb, patientId);
  }

  @Patch('orders/:id/schedule')
  @ApiOperation({ summary: 'Schedule imaging order' })
  @ApiResponse({ status: 200, description: 'Order scheduled successfully' })
  @Roles('technologist', 'radiologist', 'admin')
  async scheduleOrder(
    @Request() req: RequestWithTenant,
    @Param('id') orderId: string,
    @Body() body: { scheduled_date: string },
  ) {
    return this.imagingService.scheduleOrder(req.tenantDb, orderId, body.scheduled_date);
  }

  @Patch('orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel imaging order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @Roles('doctor', 'radiologist', 'admin')
  async cancelOrder(
    @Request() req: RequestWithTenant,
    @Param('id') orderId: string,
    @Body() body: { cancellation_reason: string },
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.cancelOrder(req.tenantDb, orderId, body.cancellation_reason, userId);
  }

  // ===== STUDIES =====

  @Post('studies')
  @ApiOperation({ summary: 'Create study from order' })
  @ApiResponse({ status: 201, description: 'Study created successfully' })
  @Roles('technologist', 'radiologist', 'admin')
  async createStudy(
    @Request() req: RequestWithTenant,
    @Body() studyData: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.createStudy(req.tenantDb, studyData, userId);
  }

  @Get('studies')
  @ApiOperation({ summary: 'Get imaging studies (worklist)' })
  @ApiResponse({ status: 200, description: 'List of imaging studies' })
  @Roles('radiologist', 'admin')
  @Roles('radiologist', 'technologist', 'admin')
  async getStudies(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('modality') modalityCode?: string,
    @Query('radiologist') radiologistId?: string,
  ) {
    return this.imagingService.getStudies(req.tenantDb, { status, modalityCode, radiologistId });
  }

  @Get('studies/:id')
  @ApiOperation({ summary: 'Get study details with images' })
  @ApiResponse({ status: 200, description: 'Study details' })
  @Roles('radiologist', 'doctor', 'admin')
  @Roles('radiologist', 'technologist', 'doctor', 'admin')
  async getStudyById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.imagingService.getStudyById(req.tenantDb, id);
  }

  @Patch('studies/:id/assign')
  @ApiOperation({ summary: 'Assign radiologist to study' })
  @ApiResponse({ status: 200, description: 'Radiologist assigned successfully' })
  @Roles('radiologist', 'admin')
  async assignRadiologist(
    @Request() req: RequestWithTenant,
    @Param('id') studyId: string,
    @Body() body: { radiologist_id: string },
  ) {
    return this.imagingService.assignRadiologist(req.tenantDb, studyId, body.radiologist_id);
  }

  @Post('studies/:id/images')
  @ApiOperation({ summary: 'Upload image to study' })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @Roles('radiologist', 'technologist', 'admin')
  @Roles('radiologist', 'technologist', 'admin')
  async uploadImage(
    @Request() req: RequestWithTenant,
    @Param('id') studyId: string,
    @Body() imageData: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.uploadImage(req.tenantDb, studyId, imageData, userId, req.tenantId);
  }

  @Get('studies/:id/images')
  @ApiOperation({ summary: 'Get study images' })
  @ApiResponse({ status: 200, description: 'Study images' })
  @Roles('radiologist', 'doctor', 'admin')
  @Roles('radiologist', 'technologist', 'doctor', 'admin')
  async getStudyImages(
    @Request() req: RequestWithTenant,
    @Param('id') studyId: string,
  ) {
    return this.imagingService.getStudyImages(req.tenantDb, studyId);
  }

  @Delete('studies/:studyId/images/:imageId')
  @ApiOperation({ summary: 'Delete image' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  @Roles('radiologist', 'admin')
  async deleteImage(
    @Request() req: RequestWithTenant,
    @Param('studyId') studyId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.imagingService.deleteImage(req.tenantDb, imageId);
  }

  // ===== REPORTS =====

  @Post('reports')
  @ApiOperation({ summary: 'Create imaging report (draft)' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  @Roles('radiologist', 'admin')
  async createReport(
    @Request() req: RequestWithTenant,
    @Body() reportData: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.createReport(req.tenantDb, reportData, userId);
  }

  @Get('reports/templates')
  @ApiOperation({ summary: 'Get report templates' })
  @ApiResponse({ status: 200, description: 'Report templates' })
  @Roles('radiologist', 'admin')
  async getReportTemplates(
    @Request() req: RequestWithTenant,
    @Query('modality') modalityId?: string,
    @Query('study_type') studyTypeId?: string,
  ) {
    return this.imagingService.getReportTemplates(req.tenantDb, { modalityId, studyTypeId });
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get report' })
  @ApiResponse({ status: 200, description: 'Report details' })
  @Roles('radiologist', 'doctor', 'admin')
  @Roles('radiologist', 'doctor', 'admin')
  async getReportById(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    return this.imagingService.getReportById(req.tenantDb, id);
  }

  @Get('reports/study/:studyId')
  @ApiOperation({ summary: 'Get report by study ID' })
  @ApiResponse({ status: 200, description: 'Report details' })
  @Roles('radiologist', 'doctor', 'admin')
  async getReportByStudyId(
    @Request() req: RequestWithTenant,
    @Param('studyId') studyId: string,
  ) {
    return this.imagingService.getReportByStudyId(req.tenantDb, studyId);
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Update report' })
  @ApiResponse({ status: 200, description: 'Report updated successfully' })
  @Roles('radiologist', 'admin')
  async updateReport(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() reportData: any,
  ) {
    return this.imagingService.updateReport(req.tenantDb, id, reportData);
  }

  @Post('reports/:id/sign')
  @ApiOperation({ summary: 'Sign and finalize report' })
  @ApiResponse({ status: 200, description: 'Report signed successfully' })
  @Roles('radiologist', 'admin')
  async signReport(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.signReport(req.tenantDb, id, userId);
  }

  @Post('reports/:id/amend')
  @ApiOperation({ summary: 'Amend signed report' })
  @ApiResponse({ status: 200, description: 'Report amended successfully' })
  @Roles('radiologist', 'admin')
  async amendReport(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: { amendment_reason: string; findings: string; impression: string },
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.amendReport(req.tenantDb, id, body, userId);
  }

  // ===== ANNOTATIONS =====

  @Post('images/:imageId/annotations')
  @ApiOperation({ summary: 'Add annotation to image' })
  @ApiResponse({ status: 201, description: 'Annotation added successfully' })
  @Roles('radiologist', 'admin')
  async addAnnotation(
    @Request() req: RequestWithTenant,
    @Param('imageId') imageId: string,
    @Body() annotationData: any,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.addAnnotation(req.tenantDb, imageId, annotationData, userId);
  }

  @Get('images/:imageId/annotations')
  @ApiOperation({ summary: 'Get image annotations' })
  @ApiResponse({ status: 200, description: 'Image annotations' })
  @Roles('radiologist', 'doctor', 'admin')
  @Roles('radiologist', 'technologist', 'doctor', 'admin')
  async getImageAnnotations(
    @Request() req: RequestWithTenant,
    @Param('imageId') imageId: string,
  ) {
    return this.imagingService.getImageAnnotations(req.tenantDb, imageId);
  }

  // ===== ORDERING PROVIDER RESULTS =====

  @Get('doctor/results')
  @ApiOperation({ summary: 'Get imaging results for ordering doctor' })
  @ApiResponse({ status: 200, description: 'Doctor imaging results' })
  @Roles('doctor', 'admin')
  async getDoctorResults(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('patient_id') patientId?: string,
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.getDoctorImagingResults(req.tenantDb, userId, { status, patientId });
  }

  @Post('reports/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge imaging report as ordering doctor' })
  @ApiResponse({ status: 200, description: 'Report acknowledged successfully' })
  @Roles('doctor', 'admin')
  async acknowledgeReport(
    @Request() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: { acknowledgment_notes?: string },
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.acknowledgeReport(req.tenantDb, id, userId, body?.acknowledgment_notes);
  }

  // ===== RADIOLOGIST WORKLIST =====

  @Get('worklist')
  @ApiOperation({ summary: 'Get radiologist worklist (unreported studies)' })
  @ApiResponse({ status: 200, description: 'Radiologist worklist' })
  @Roles('radiologist', 'admin')
  @Roles('radiologist', 'technologist', 'admin')
  async getRadiologistWorklist(@Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.getRadiologistWorklist(req.tenantDb, userId);
  }

  @Get('worklist/my-studies')
  @ApiOperation({ summary: 'Get studies assigned to current radiologist' })
  @ApiResponse({ status: 200, description: 'Assigned studies' })
  @Roles('radiologist', 'admin')
  async getMyStudies(@Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.getMyStudies(req.tenantDb, userId);
  }

  // ===== STATISTICS =====

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get imaging statistics' })
  @ApiResponse({ status: 200, description: 'Imaging statistics' })
  @Roles('radiologist', 'admin')
  @Roles('radiologist', 'technologist', 'admin')
  async getImagingStats(@Request() req: RequestWithTenant) {
    return this.imagingService.getImagingStats(req.tenantDb);
  }

  @Patch('studies/:id/complete')
  @ApiOperation({ summary: 'Mark study as completed and ready for reporting' })
  @ApiResponse({ status: 200, description: 'Study marked as completed' })
  @Roles('technologist', 'radiologist', 'admin')
  async completeStudy(
    @Request() req: RequestWithTenant,
    @Param('id') studyId: string,
    @Body() body: { completion_notes?: string },
  ) {
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    return this.imagingService.completeStudy(req.tenantDb, studyId, userId, body?.completion_notes);
  }
}

