import { Controller, Post, Get, Body, Param, UseGuards, Request, Logger, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CdssService } from '../services/cdss.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadSecurityService } from '../services/upload-security.service';

@ApiTags('Clinical Decision Support System')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cdss')
export class CdssController {
  private readonly logger = new Logger(CdssController.name);
  
  constructor(
    private cdssService: CdssService,
    private readonly uploadSecurityService: UploadSecurityService,
  ) {}

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
    return this.cdssService.diagnosisAssist(symptoms, true, req.tenantId, req.tenantDb);
  }

  @Post('guidelines')
  @ApiOperation({ summary: 'Get clinical guidelines for condition' })
  @ApiResponse({ status: 200, description: 'Clinical guidelines retrieved' })
  async getGuidelines(
    @Body() body: { condition: string, patientData?: any },
    @Request() req: RequestWithTenant
  ) {
    return this.cdssService.getGuidelines(body.condition, body.patientData, req.tenantId, req.tenantDb);
  }

  @Post('guidelines/search')
  @ApiOperation({ summary: 'Search clinical guidelines' })
  @ApiResponse({ status: 200, description: 'Guidelines found' })
  async searchGuidelines(@Body() body: { query: string, limit?: number, patient_context?: any }, @Request() req: RequestWithTenant) {
    return this.cdssService.searchGuidelines(body.query, body.limit, body.patient_context, req.tenantId, req.tenantDb);
  }

  @Post('analyze-image')
  @ApiOperation({ summary: 'Analyze medical image through CDSS' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Medical image analyzed' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const allowedMimes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'application/dicom',
        'application/octet-stream',
      ]);
      const original = (file.originalname || '').toLowerCase();
      const allowedByExt = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff', '.dcm']
        .some((ext) => original.endsWith(ext));
      const allowedByMime = allowedMimes.has((file.mimetype || '').toLowerCase());
      if (allowedByMime || allowedByExt) {
        callback(null, true);
      } else {
        callback(
          new HttpException(
            'Invalid image file type. Allowed: JPEG, PNG, WEBP, BMP, TIFF, DICOM',
            HttpStatus.BAD_REQUEST,
          ),
          false,
        );
      }
    },
  }))
  async analyzeMedicalImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithTenant,
  ) {
    if (!file) {
      throw new HttpException('Image file is required', HttpStatus.BAD_REQUEST);
    }
    await this.uploadSecurityService.assertCleanUpload(file, 'image');
    return this.cdssService.analyzeMedicalImage(file, req.tenantId);
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

  @Post('allergy-check-structured')
  @ApiOperation({ summary: 'Structured allergy check with cross-reactivity analysis' })
  @ApiResponse({ status: 200, description: 'Structured allergy check with cross-reactivity warnings' })
  async allergyCheckStructured(
    @Body() data: { patientId: string; medications: string[] },
    @Request() req: RequestWithTenant,
  ) {
    return this.cdssService.getAllergyWarnings(data.patientId, data.medications, req.tenantDb);
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

  @Post('triage/analyze')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Analyze triage context and return copilot recommendations' })
  @ApiResponse({ status: 200, description: 'Triage copilot analysis completed' })
  async analyzeTriage(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.analyzeNurseTriage(body, req.tenantDb, req.tenantId);
  }

  @Post('vitals/interpret')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Interpret vitals and return risk-oriented recommendations' })
  @ApiResponse({ status: 200, description: 'Vitals interpretation completed' })
  async interpretVitals(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.interpretNurseVitals(body, req.tenantDb, req.tenantId);
  }

  @Post('notes/draft')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Generate structured nursing note draft from contextual inputs' })
  @ApiResponse({ status: 200, description: 'Nursing note draft generated' })
  async draftNursingNotes(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.generateNurseNoteDraft(body, req.tenantId, req.tenantDb);
  }

  @Post('handoff/summary')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Generate nurse handoff summary from patient shift context' })
  @ApiResponse({ status: 200, description: 'Nurse handoff summary generated' })
  async generateHandoffSummary(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.generateNurseHandoffSummary(body, req.tenantId, req.tenantDb);
  }

  @Post('copilot/action')
  @Roles('nurse', 'doctor', 'admin')
  @ApiOperation({ summary: 'Record copilot decision lifecycle event (accept/modify/reject)' })
  @ApiResponse({ status: 200, description: 'Copilot action recorded' })
  async recordCopilotAction(@Body() body: any, @Request() req: RequestWithTenant) {
    return this.cdssService.recordCopilotAction(body, req.tenantId);
  }
}
