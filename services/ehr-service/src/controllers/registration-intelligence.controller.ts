import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { RegistrationIntelligenceService } from '../services/registration-intelligence.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Registration Intelligence')
@Controller('registration-intelligence')
export class RegistrationIntelligenceController {
  constructor(private readonly registrationIntelligenceService: RegistrationIntelligenceService) {}

  @Post('duplicates')
  @ApiOperation({ summary: 'Find duplicate-patient candidates for registration or intake' })
  async findDuplicateCandidates(@Body() body: any, @Req() req: RequestWithTenant): Promise<any> {
    return this.registrationIntelligenceService.findDuplicateCandidates(req.tenantDb!, body || {});
  }

  @Get('duplicates/review')
  @ApiOperation({ summary: 'List duplicate-review queue items for registration intake' })
  async listDuplicateReviewQueue(
    @Query('sourceReference') sourceReference: string | undefined,
    @Query('status') status: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: RequestWithTenant,
  ): Promise<any> {
    return this.registrationIntelligenceService.listDuplicateReviewQueue(req.tenantDb!, {
      sourceReference,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('duplicates/review/:id')
  @ApiOperation({ summary: 'Review or resolve a duplicate-patient suggestion' })
  async reviewDuplicateCandidate(
    @Param('id') id: string,
    @Body() body: { matchStatus: string },
    @Req() req: RequestWithTenant,
  ): Promise<any> {
    return this.registrationIntelligenceService.reviewDuplicateCandidate(
      req.tenantDb!,
      id,
      body || { matchStatus: 'suggested' },
      req.user?.userId || req.user?.id || null,
    );
  }

  @Post('assess')
  @ApiOperation({ summary: 'Assess registration intake completeness, duplicate risk, coverage risk, and consent readiness' })
  async assessRegistrationIntake(@Body() body: any, @Req() req: RequestWithTenant): Promise<any> {
    return this.registrationIntelligenceService.assessRegistrationIntake(req.tenantDb!, body || {}, {
      actorUserId: req.user?.userId || req.user?.id || null,
    });
  }

  @Post('eligibility/verify')
  @ApiOperation({ summary: 'Run and persist live eligibility verification for registration intake' })
  async verifyInsuranceEligibility(@Body() body: any, @Req() req: RequestWithTenant): Promise<any> {
    return this.registrationIntelligenceService.verifyInsuranceEligibility(req.tenantDb!, body || {}, {
      actorUserId: req.user?.userId || req.user?.id || null,
      sourceAssessmentId: body?.sourceAssessmentId || null,
    });
  }

  @Post('documents/extract')
  @ApiOperation({ summary: 'Extract structured data from registration intake documents' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: { type: 'string' },
        patientId: { type: 'string' },
        language: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async extractDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: RequestWithTenant,
  ): Promise<any> {
    return this.registrationIntelligenceService.extractRegistrationDocument(
      req.tenantDb!,
      file,
      {
        patientId: body?.patientId,
        documentType: body?.documentType,
        language: body?.language,
        actorUserId: req.user?.userId || req.user?.id || null,
        tenantId: req.tenantId || null,
      },
    );
  }
}
