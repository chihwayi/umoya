import { Controller, Get, Post, Query, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CcdaService, CcdaDocumentOptions } from '../services/ccda.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('CCDA Documents')
@ApiBearerAuth()
@Controller('ccda')
@UseGuards(JwtAuthGuard)
export class CcdaController {
  constructor(private readonly ccdaService: CcdaService) {}

  @Get('ccd/:patientId')
  @ApiOperation({ summary: 'Generate Continuity of Care Document (CCD)' })
  @ApiParam({ name: 'patientId', description: 'Patient ID', required: true })
  @ApiQuery({ name: 'effectiveTime', description: 'Document effective time (ISO 8601)', required: false })
  @ApiQuery({ name: 'authorId', description: 'Author user ID', required: false })
  @ApiResponse({ status: 200, description: 'CCD document generated successfully', type: String })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async generateCCD(
    @Param('patientId') patientId: string,
    @Query('effectiveTime') effectiveTime?: string,
    @Query('authorId') authorId?: string,
    @Request() req?: RequestWithTenant,
  ) {
    const options: CcdaDocumentOptions = {
      patientId,
      documentType: 'CCD',
      effectiveTime: effectiveTime ? new Date(effectiveTime) : undefined,
      authorId: authorId || (req?.user as any)?.id || (req?.user as any)?.userId,
    };
    return this.ccdaService.generateCCD(options, req.tenantDb);
  }

  @Get('discharge-summary/:patientId')
  @ApiOperation({ summary: 'Generate Discharge Summary' })
  @ApiParam({ name: 'patientId', description: 'Patient ID', required: true })
  @ApiQuery({ name: 'encounterId', description: 'Encounter/Appointment ID', required: true })
  @ApiQuery({ name: 'effectiveTime', description: 'Document effective time (ISO 8601)', required: false })
  @ApiQuery({ name: 'authorId', description: 'Author user ID', required: false })
  @ApiResponse({ status: 200, description: 'Discharge summary generated successfully', type: String })
  @ApiResponse({ status: 404, description: 'Patient or encounter not found' })
  async generateDischargeSummary(
    @Param('patientId') patientId: string,
    @Query('encounterId') encounterId: string,
    @Query('effectiveTime') effectiveTime?: string,
    @Query('authorId') authorId?: string,
    @Request() req?: RequestWithTenant,
  ) {
    const options: CcdaDocumentOptions = {
      patientId,
      documentType: 'DischargeSummary',
      encounterId,
      effectiveTime: effectiveTime ? new Date(effectiveTime) : undefined,
      authorId: authorId || (req?.user as any)?.id || (req?.user as any)?.userId,
    };
    return this.ccdaService.generateDischargeSummary(options, req.tenantDb);
  }

  @Get('referral-summary/:patientId')
  @ApiOperation({ summary: 'Generate Referral Summary' })
  @ApiParam({ name: 'patientId', description: 'Patient ID', required: true })
  @ApiQuery({ name: 'effectiveTime', description: 'Document effective time (ISO 8601)', required: false })
  @ApiQuery({ name: 'authorId', description: 'Author user ID', required: false })
  @ApiResponse({ status: 200, description: 'Referral summary generated successfully', type: String })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async generateReferralSummary(
    @Param('patientId') patientId: string,
    @Query('effectiveTime') effectiveTime?: string,
    @Query('authorId') authorId?: string,
    @Request() req?: RequestWithTenant,
  ) {
    const options: CcdaDocumentOptions = {
      patientId,
      documentType: 'ReferralSummary',
      effectiveTime: effectiveTime ? new Date(effectiveTime) : undefined,
      authorId: authorId || (req?.user as any)?.id || (req?.user as any)?.userId,
    };
    return this.ccdaService.generateReferralSummary(options, req.tenantDb);
  }

  @Get('progress-note/:patientId')
  @ApiOperation({ summary: 'Generate Progress Note' })
  @ApiParam({ name: 'patientId', description: 'Patient ID', required: true })
  @ApiQuery({ name: 'encounterId', description: 'Encounter/Appointment ID', required: true })
  @ApiQuery({ name: 'effectiveTime', description: 'Document effective time (ISO 8601)', required: false })
  @ApiQuery({ name: 'authorId', description: 'Author user ID', required: false })
  @ApiResponse({ status: 200, description: 'Progress note generated successfully', type: String })
  @ApiResponse({ status: 404, description: 'Patient or encounter not found' })
  async generateProgressNote(
    @Param('patientId') patientId: string,
    @Query('encounterId') encounterId: string,
    @Query('effectiveTime') effectiveTime?: string,
    @Query('authorId') authorId?: string,
    @Request() req?: RequestWithTenant,
  ) {
    const options: CcdaDocumentOptions = {
      patientId,
      documentType: 'ProgressNote',
      encounterId,
      effectiveTime: effectiveTime ? new Date(effectiveTime) : undefined,
      authorId: authorId || (req?.user as any)?.id || (req?.user as any)?.userId,
    };
    return this.ccdaService.generateProgressNote(options, req.tenantDb);
  }
}


