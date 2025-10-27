import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { CdssService } from '../services/cdss.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Clinical Decision Support System')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cdss')
export class CdssController {
  constructor(private cdssService: CdssService) {}

  @Post('drug-interactions')
  @ApiOperation({ summary: 'Check drug interactions' })
  @ApiResponse({ status: 200, description: 'Drug interactions analyzed' })
  async checkDrugInteractions(@Body() medications: string[], @Request() req: RequestWithTenant) {
    return this.cdssService.checkDrugInteractions(medications);
  }

  @Post('diagnosis-assist')
  @ApiOperation({ summary: 'AI-powered diagnostic assistance' })
  @ApiResponse({ status: 200, description: 'Diagnostic suggestions provided' })
  async diagnosisAssist(@Body() symptoms: any, @Request() req: RequestWithTenant) {
    return this.cdssService.diagnosisAssist(symptoms);
  }

  @Get('guidelines/:condition')
  @ApiOperation({ summary: 'Get clinical guidelines for condition' })
  @ApiResponse({ status: 200, description: 'Clinical guidelines retrieved' })
  async getGuidelines(@Param('condition') condition: string, @Request() req: RequestWithTenant) {
    return this.cdssService.getGuidelines(condition);
  }

  @Post('risk-assessment')
  @ApiOperation({ summary: 'Patient risk assessment' })
  @ApiResponse({ status: 200, description: 'Risk assessment completed' })
  async riskAssessment(@Body() patientData: any, @Request() req: RequestWithTenant) {
    return this.cdssService.riskAssessment(patientData);
  }

  @Post('allergy-check')
  @ApiOperation({ summary: 'Check medication allergies' })
  @ApiResponse({ status: 200, description: 'Allergy check completed' })
  async allergyCheck(@Body() data: { patientId: string, medication: string }, @Request() req: RequestWithTenant) {
    return this.cdssService.allergyCheck(data.patientId, data.medication, req.tenantDb);
  }
}