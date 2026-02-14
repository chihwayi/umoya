import { Controller, Post, Get, Body, Param, UseGuards, Request, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(CdssController.name);
  
  constructor(private cdssService: CdssService) {}

  @Post('drug-interactions')
  @ApiOperation({ summary: 'Check drug interactions' })
  @ApiResponse({ status: 200, description: 'Drug interactions analyzed' })
  async checkDrugInteractions(
    @Body() body: { drugIds: string[], patientId?: string },
    @Request() req: RequestWithTenant
  ) {
    return this.cdssService.checkDrugInteractions(
      body.drugIds,
      body.patientId,
      req.tenantDb
    );
  }

  @Post('diagnosis-assist')
  @ApiOperation({ summary: 'AI-powered diagnostic assistance' })
  @ApiResponse({ status: 200, description: 'Diagnostic suggestions provided' })
  async diagnosisAssist(@Body() symptoms: any, @Request() req: RequestWithTenant) {
    return this.cdssService.diagnosisAssist(symptoms, true, req.tenantId);
  }

  @Post('guidelines')
  @ApiOperation({ summary: 'Get clinical guidelines for condition' })
  @ApiResponse({ status: 200, description: 'Clinical guidelines retrieved' })
  async getGuidelines(
    @Body() body: { condition: string, patientData?: any },
    @Request() req: RequestWithTenant
  ) {
    return this.cdssService.getGuidelines(body.condition, body.patientData, req.tenantId);
  }

  @Post('guidelines/search')
  @ApiOperation({ summary: 'Search clinical guidelines' })
  @ApiResponse({ status: 200, description: 'Guidelines found' })
  async searchGuidelines(@Body() body: { query: string, limit?: number, patient_context?: any }, @Request() req: RequestWithTenant) {
    return this.cdssService.searchGuidelines(body.query, body.limit, body.patient_context, req.tenantId);
  }

  @Post('risk-assessment')
  @ApiOperation({ summary: 'Patient risk assessment' })
  @ApiResponse({ status: 200, description: 'Risk assessment completed' })
  async riskAssessment(@Body() patientData: any, @Request() req: RequestWithTenant) {
    this.logger.log(`[CdssController] riskAssessment - tenantDb: ${!!req.tenantDb}, patientId: ${patientData?.patientId || 'undefined'}`);
    const result = await this.cdssService.riskAssessment(patientData, req.tenantDb, req.tenantId);
    this.logger.log(`[CdssController] riskAssessment result - has historical_context: ${!!result?.historical_context}, has trends: ${!!result?.trends}`);
    return result;
  }

  @Post('allergy-check')
  @ApiOperation({ summary: 'Check medication allergies' })
  @ApiResponse({ status: 200, description: 'Allergy check completed' })
  async allergyCheck(@Body() data: { patientId: string, medication: string }, @Request() req: RequestWithTenant) {
    return this.cdssService.allergyCheck(data.patientId, data.medication, req.tenantDb);
  }

  @Post('dosing-recommendation')
  @ApiOperation({ summary: 'Get medication dosing recommendation' })
  @ApiResponse({ status: 200, description: 'Dosing recommendation provided' })
  async getDosingRecommendation(@Body() dosingRequest: any, @Request() req: RequestWithTenant) {
    return this.cdssService.getDosingRecommendation(dosingRequest);
  }

  @Post('labs/interpret')
  @ApiOperation({ summary: 'Interpret lab results' })
  @ApiResponse({ status: 200, description: 'Lab results interpreted' })
  async interpretLabResults(@Body() body: { labResults: any, historicalLabs?: any[] }, @Request() req: RequestWithTenant) {
    return this.cdssService.interpretLabResults(body.labResults, body.historicalLabs);
  }

  @Post('medications/duplicates')
  @ApiOperation({ summary: 'Detect duplicate therapy' })
  @ApiResponse({ status: 200, description: 'Duplicate therapy detected' })
  async detectDuplicateTherapy(@Body() body: { medications: any[], prescriptions?: any[] }, @Request() req: RequestWithTenant) {
    return this.cdssService.detectDuplicateTherapy(body.medications, body.prescriptions);
  }

  @Post('medications/high-risk')
  @ApiOperation({ summary: 'Check high-risk medications' })
  @ApiResponse({ status: 200, description: 'High-risk medications checked' })
  async checkHighRiskMedications(@Body() body: { medications: any[], patientAge?: number, patientGender?: string, diagnoses?: string[], renalFunction?: number }, @Request() req: RequestWithTenant) {
    return this.cdssService.checkHighRiskMedications(
      body.medications,
      body.patientAge,
      body.patientGender,
      body.diagnoses,
      body.renalFunction
    );
  }

  @Post('medications/food-interactions')
  @ApiOperation({ summary: 'Check drug–food interactions' })
  @ApiResponse({ status: 200, description: 'Drug–food interactions checked' })
  async checkFoodInteractions(@Body() body: { medications: any[] }, @Request() req: RequestWithTenant) {
    return this.cdssService.checkFoodInteractions(body.medications);
  }

  @Post('care-gaps/detect')
  @ApiOperation({ summary: 'Detect care gaps' })
  @ApiResponse({ status: 200, description: 'Care gaps detected' })
  async detectCareGaps(@Body() body: { patientAge?: number, patientGender?: string, visitHistory?: any[], diagnoses?: string[] }, @Request() req: RequestWithTenant) {
    return this.cdssService.detectCareGaps(
      body.patientAge,
      body.patientGender,
      body.visitHistory,
      body.diagnoses
    );
  }
}
