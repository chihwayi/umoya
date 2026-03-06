import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import {
  AcknowledgePostVisitIntraVisitAlertDto,
  AnalyzePostVisitIntraVisitAlertDto,
  ClassifyPostVisitEscalationDto,
  CreatePostVisitSessionDto,
  CuratePostVisitCompanionMemoryDto,
  ExecutePostVisitVoiceCommandDto,
  GeneratePostVisitAdminDocumentsDto,
  IngestPostVisitDocumentIntelligenceDto,
  PublishPostVisitSessionDto,
  ReassignPostVisitDiarizationSegmentDto,
  ResolvePostVisitIntraVisitAlertDto,
  ResolvePostVisitEscalationDto,
  ExecutePostVisitRecommendationDto,
  RegeneratePostVisitDraftDto,
  ReviewPostVisitBillingSuggestionDto,
  ReviewPostVisitArtifactDto,
  ReviewPostVisitTrialMatchDto,
} from '../dto/post-visit.dto';
import { PostVisitService } from '../services/post-visit.service';
import { UploadSecurityService } from '../services/upload-security.service';

@ApiTags('Post Visit AI Companion')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('post-visit')
export class PostVisitController {
  constructor(
    private readonly postVisitService: PostVisitService,
    private readonly uploadSecurityService: UploadSecurityService,
  ) {}

  private resolveUserId(req: RequestWithTenant) {
    const user = req.user as any;
    return user?.id || user?.userId || user?.sub || null;
  }

  @Post('sessions')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Create a post-visit session linked to appointment/consultation context' })
  @ApiResponse({ status: 201, description: 'Post-visit session created' })
  async createSession(@Body() body: CreatePostVisitSessionDto, @Request() req: RequestWithTenant) {
    return this.postVisitService.createSession(req.tenantDb, body, {
      tenantId: req.tenantId,
      actorUserId: this.resolveUserId(req),
    });
  }

  @Get('sessions')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List post-visit sessions for clinician workspace' })
  @ApiResponse({ status: 200, description: 'Post-visit sessions listed' })
  async listSessions(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('sourceType') sourceType?: string,
    @Query('publishedOnly') publishedOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const normalizedStatus = (
      ['captured', 'processing', 'draft_ready', 'doctor_reviewed', 'published', 'closed'].includes(
        String(status || '').toLowerCase(),
      )
        ? String(status || '').toLowerCase()
        : undefined
    ) as
      | 'captured'
      | 'processing'
      | 'draft_ready'
      | 'doctor_reviewed'
      | 'published'
      | 'closed'
      | undefined;

    const normalizedSourceType = (
      ['in_person', 'telemedicine', 'hybrid'].includes(String(sourceType || '').toLowerCase())
        ? String(sourceType || '').toLowerCase()
        : undefined
    ) as 'in_person' | 'telemedicine' | 'hybrid' | undefined;

    const includePublishedOnly = ['1', 'true', 'yes', 'published'].includes(
      String(publishedOnly || '').toLowerCase(),
    );

    return this.postVisitService.listSessions(req.tenantDb, {
      status: normalizedStatus,
      patientId: patientId || undefined,
      doctorId: doctorId || undefined,
      sourceType: normalizedSourceType,
      includePublishedOnly,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('sessions/:id')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get a post-visit session by ID' })
  @ApiResponse({ status: 200, description: 'Post-visit session fetched' })
  async getSession(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.postVisitService.getSession(req.tenantDb, id);
  }

  @Get('sessions/:id/draft')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get current draft artifacts, transcript, and extracted entities for a session' })
  @ApiResponse({ status: 200, description: 'Post-visit draft fetched' })
  async getSessionDraft(@Param('id') id: string, @Request() req: RequestWithTenant): Promise<any> {
    return this.postVisitService.getSessionDraft(req.tenantDb, id);
  }

  @Get('sessions/:id/fhir')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get FHIR R4 projection bundle for a post-visit session' })
  @ApiResponse({ status: 200, description: 'Post-visit FHIR projection generated' })
  async getSessionFhirProjection(@Param('id') id: string, @Request() req: RequestWithTenant): Promise<any> {
    return this.postVisitService.getSessionFhirProjection(req.tenantDb, id);
  }

  @Get('sessions/:id/mobile-contract')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get versioned mobile payload contract for post-visit session cards/checklist' })
  @ApiResponse({ status: 200, description: 'Post-visit mobile contract generated' })
  async getSessionMobileContract(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('version') version?: string,
  ): Promise<any> {
    return this.postVisitService.getSessionMobileContract(req.tenantDb, id, { version });
  }

  @Get('sessions/:id/mobile-events')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get versioned post-visit mobile event feed for push-sync consumers' })
  @ApiResponse({ status: 200, description: 'Post-visit mobile event feed generated' })
  async getSessionMobileEvents(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('version') version?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<any> {
    return this.postVisitService.listSessionMobileEvents(req.tenantDb, id, {
      version,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('sessions/:id/draft/regenerate')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Regenerate structured post-visit draft artifacts from transcript + patient context' })
  @ApiResponse({ status: 200, description: 'Post-visit draft regenerated' })
  async regenerateDraft(
    @Param('id') id: string,
    @Body() body: RegeneratePostVisitDraftDto,
    @Request() req: RequestWithTenant,
  ): Promise<any> {
    return this.postVisitService.generateDraftArtifacts(req.tenantDb, id, {
      tenantId: req.tenantId,
      actorUserId: this.resolveUserId(req),
      source: 'post_visit_regenerate_endpoint',
      reason: body.reason,
    });
  }

  @Post('sessions/:id/review')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Persist doctor review action for a post-visit draft artifact' })
  @ApiResponse({ status: 200, description: 'Post-visit artifact review action recorded' })
  async reviewArtifact(
    @Param('id') id: string,
    @Body() body: ReviewPostVisitArtifactDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.reviewDraftArtifact(req.tenantDb, id, body, {
      tenantId: req.tenantId,
      actorUserId: this.resolveUserId(req),
      source: 'post_visit_review_endpoint',
    });
  }

  @Post('sessions/:id/admin-docs/generate')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Generate and sign template-driven post-visit admin documents' })
  @ApiResponse({ status: 200, description: 'Post-visit admin documents generated' })
  async generateSessionAdminDocuments(
    @Param('id') id: string,
    @Body() body: GeneratePostVisitAdminDocumentsDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.generateSessionAdminDocuments(
      req.tenantDb,
      id,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Get('sessions/:id/admin-docs')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'List generated post-visit admin documents for doctor workspace' })
  @ApiResponse({ status: 200, description: 'Post-visit admin documents listed' })
  async listSessionAdminDocuments(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.listSessionAdminDocuments(req.tenantDb, id);
  }

  @Get('sessions/:id/trial-matches')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'List or refresh de-identified clinical trial matches for a post-visit session' })
  @ApiResponse({ status: 200, description: 'Post-visit trial matches listed' })
  async listSessionTrialMatches(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('refresh') refresh?: string,
  ) {
    return this.postVisitService.listSessionTrialMatches(req.tenantDb, id, {
      refresh: ['1', 'true', 'yes', 'refresh'].includes(String(refresh || '').toLowerCase()),
      actorUserId: this.resolveUserId(req),
    });
  }

  @Post('sessions/:id/trial-matches/:matchId/review')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Record doctor decision for a post-visit trial match candidate' })
  @ApiResponse({ status: 200, description: 'Post-visit trial match decision persisted' })
  async reviewTrialMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() body: ReviewPostVisitTrialMatchDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.reviewTrialMatch(
      req.tenantDb,
      id,
      matchId,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Get('sessions/:id/trial-matches/:matchId/audit')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List doctor trial-match action audit timeline for drilldown' })
  @ApiResponse({ status: 200, description: 'Post-visit trial match audit timeline listed' })
  async listTrialMatchAuditLog(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Request() req: RequestWithTenant,
    @Query('limit') limit?: string,
  ) {
    return this.postVisitService.listTrialMatchAuditLog(req.tenantDb, id, matchId, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('sessions/:id/companion-memory')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List longitudinal patient companion memory profile for a session context' })
  @ApiResponse({ status: 200, description: 'Post-visit companion memory listed' })
  async listSessionCompanionMemory(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.postVisitService.listSessionCompanionMemory(req.tenantDb, id, {
      limit: limit ? Number(limit) : undefined,
      includeInactive: ['1', 'true', 'yes', 'all'].includes(String(includeInactive || '').toLowerCase()),
    });
  }

  @Post('sessions/:id/companion-memory/:memoryId/curate')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Curate companion memory entries (promote/retire/reactivate) from doctor workspace' })
  @ApiResponse({ status: 200, description: 'Post-visit companion memory curation saved' })
  async curateCompanionMemory(
    @Param('id') id: string,
    @Param('memoryId') memoryId: string,
    @Body() body: CuratePostVisitCompanionMemoryDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.curateCompanionMemory(
      req.tenantDb,
      id,
      memoryId,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Get('analytics/trial-memory')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get post-visit trial funnel and companion memory analytics snapshot' })
  @ApiResponse({ status: 200, description: 'Post-visit trial/memory analytics fetched' })
  async getTrialMemoryAnalytics(
    @Request() req: RequestWithTenant,
    @Query('days') days?: string,
    @Query('routeTarget') routeTarget?: string,
  ) {
    const normalizedRouteTarget = (
      ['doctor', 'nurse', 'emergency'].includes(String(routeTarget || '').toLowerCase())
        ? String(routeTarget || '').toLowerCase()
        : undefined
    ) as 'doctor' | 'nurse' | 'emergency' | undefined;

    return this.postVisitService.getTrialMemoryAnalytics(req.tenantDb, {
      days: days ? Number(days) : undefined,
      routeTarget: normalizedRouteTarget,
    });
  }

  @Get('analytics/trial-sla-accountability')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Get per-clinician trial decision SLA accountability metrics' })
  @ApiResponse({ status: 200, description: 'Post-visit trial SLA accountability analytics fetched' })
  async getTrialDecisionSlaAccountability(
    @Request() req: RequestWithTenant,
    @Query('days') days?: string,
    @Query('routeTarget') routeTarget?: string,
    @Query('clinicianId') clinicianId?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedRouteTarget = (
      ['doctor', 'nurse', 'emergency'].includes(String(routeTarget || '').toLowerCase())
        ? String(routeTarget || '').toLowerCase()
        : undefined
    ) as 'doctor' | 'nurse' | 'emergency' | undefined;

    return this.postVisitService.getTrialDecisionSlaAccountability(req.tenantDb, {
      days: days ? Number(days) : undefined,
      routeTarget: normalizedRouteTarget,
      clinicianId: clinicianId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('reports/trial-memory-audit')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Export trial + companion memory audit feed (JSON/CSV) for UAT/compliance' })
  @ApiResponse({ status: 200, description: 'Post-visit trial/memory audit export generated' })
  async exportTrialMemoryAudit(
    @Request() req: RequestWithTenant,
    @Query('days') days?: string,
    @Query('format') format?: string,
    @Query('routeTarget') routeTarget?: string,
    @Query('clinicianId') clinicianId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedRouteTarget = (
      ['doctor', 'nurse', 'emergency'].includes(String(routeTarget || '').toLowerCase())
        ? String(routeTarget || '').toLowerCase()
        : undefined
    ) as 'doctor' | 'nurse' | 'emergency' | undefined;

    return this.postVisitService.exportTrialMemoryAudit(req.tenantDb, {
      days: days ? Number(days) : undefined,
      format: format ? String(format).trim().toLowerCase() : undefined,
      routeTarget: normalizedRouteTarget,
      clinicianId: clinicianId || undefined,
      sessionId: sessionId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('coordination/trial-decisions')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List shared nurse/doctor trial decision SLA coordination queue' })
  @ApiResponse({ status: 200, description: 'Post-visit trial decision queue fetched' })
  async listTrialDecisionCoordinationQueue(
    @Request() req: RequestWithTenant,
    @Query('status') status?: string,
    @Query('routeTarget') routeTarget?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const normalizedStatus = (
      ['open', 'acknowledged', 'resolved', 'dismissed'].includes(String(status || '').toLowerCase())
        ? String(status || '').toLowerCase()
        : undefined
    ) as 'open' | 'acknowledged' | 'resolved' | 'dismissed' | undefined;
    const normalizedRouteTarget = (
      ['doctor', 'nurse', 'emergency'].includes(String(routeTarget || '').toLowerCase())
        ? String(routeTarget || '').toLowerCase()
        : undefined
    ) as 'doctor' | 'nurse' | 'emergency' | undefined;

    return this.postVisitService.listTrialDecisionCoordinationQueue(req.tenantDb, {
      status: normalizedStatus,
      routeTarget: normalizedRouteTarget,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('sessions/:id/voice-command')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Execute doctor voice command intents for review/signoff workflow' })
  @ApiResponse({ status: 200, description: 'Voice command executed' })
  async executeVoiceCommand(
    @Param('id') id: string,
    @Body() body: ExecutePostVisitVoiceCommandDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.executeVoiceReviewCommand(
      req.tenantDb,
      id,
      body,
      {
        tenantId: req.tenantId,
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Post('sessions/:id/transcribe')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Transcribe session audio and persist transcript + extraction + draft artifacts' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
        },
        language: {
          type: 'string',
          enum: ['en', 'sn', 'nd', 'auto'],
          default: 'auto',
        },
        temperature: {
          type: 'number',
          default: 0.0,
        },
        prompt: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Session transcription persisted' })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'audio/wav',
          'audio/mpeg',
          'audio/mp3',
          'audio/m4a',
          'audio/webm',
          'audio/ogg',
          'audio/x-m4a',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new HttpException(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`, HttpStatus.BAD_REQUEST), false);
        }
      },
    }),
  )
  async transcribeSession(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { language?: string; temperature?: string; prompt?: string },
    @Request() req: RequestWithTenant,
  ): Promise<any> {
    if (!file) {
      throw new HttpException('Audio file is required', HttpStatus.BAD_REQUEST);
    }
    await this.uploadSecurityService.assertCleanUpload(file, 'audio');

    return this.postVisitService.transcribeSessionAudio(
      req.tenantDb,
      id,
      file,
      {
        language: (body.language as 'en' | 'sn' | 'nd' | 'auto') || 'auto',
        temperature: body.temperature ? Number(body.temperature) : 0.0,
        prompt: body.prompt || 'This is a medical consultation between a doctor and patient. Medical terminology should be transcribed accurately.',
      },
      {
        tenantId: req.tenantId,
        authorization: req.headers?.authorization as string | undefined,
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Post('sessions/:id/intravisit/analyze-audio')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Transcribe and analyze a live audio chunk for intra-visit safety alerts' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
        },
        language: {
          type: 'string',
          enum: ['en', 'sn', 'nd', 'auto'],
          default: 'auto',
        },
        temperature: {
          type: 'number',
          default: 0.0,
        },
        prompt: {
          type: 'string',
        },
        source: {
          type: 'string',
          default: 'streamed_audio_chunk',
        },
        transcriptOffsetSeconds: {
          type: 'number',
        },
      },
      required: ['audio'],
    },
  })
  @ApiResponse({ status: 200, description: 'Intra-visit audio chunk analyzed' })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'audio/wav',
          'audio/mpeg',
          'audio/mp3',
          'audio/m4a',
          'audio/webm',
          'audio/ogg',
          'audio/x-m4a',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new HttpException(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`, HttpStatus.BAD_REQUEST),
            false,
          );
        }
      },
    }),
  )
  async analyzeIntraVisitAudioChunk(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { language?: string; temperature?: string; prompt?: string; source?: string; transcriptOffsetSeconds?: string },
    @Request() req: RequestWithTenant,
  ) {
    if (!file) {
      throw new HttpException('Audio file is required', HttpStatus.BAD_REQUEST);
    }
    await this.uploadSecurityService.assertCleanUpload(file, 'audio');
    return this.postVisitService.analyzeIntraVisitAudioChunk(
      req.tenantDb,
      id,
      file,
      {
        language: (body.language as 'en' | 'sn' | 'nd' | 'auto') || 'auto',
        temperature: body.temperature ? Number(body.temperature) : 0.0,
        prompt: body.prompt,
        source: body.source,
        transcriptOffsetSeconds: body.transcriptOffsetSeconds ? Number(body.transcriptOffsetSeconds) : undefined,
      },
      {
        tenantId: req.tenantId,
        authorization: req.headers?.authorization as string | undefined,
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Post('sessions/:id/intravisit/analyze')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Analyze a live transcript chunk for intra-visit safety alerts' })
  @ApiResponse({ status: 200, description: 'Intra-visit transcript chunk analyzed' })
  async analyzeIntraVisitAlertChunk(
    @Param('id') id: string,
    @Body() body: AnalyzePostVisitIntraVisitAlertDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.analyzeIntraVisitAlerts(
      req.tenantDb,
      id,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Get('sessions/:id/intravisit/alerts')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List intra-visit safety alerts for a post-visit session' })
  @ApiResponse({ status: 200, description: 'Intra-visit alerts fetched' })
  async listIntraVisitAlerts(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('status') status?: 'open' | 'confirmed' | 'dismissed',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.postVisitService.listIntraVisitAlerts(
      req.tenantDb,
      id,
      {
        status,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
    );
  }

  @Post('sessions/:id/intravisit/alerts/:alertId/resolve')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Confirm or dismiss an intra-visit safety alert' })
  @ApiResponse({ status: 200, description: 'Intra-visit alert updated' })
  async resolveIntraVisitAlert(
    @Param('id') id: string,
    @Param('alertId') alertId: string,
    @Body() body: ResolvePostVisitIntraVisitAlertDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.resolveIntraVisitAlert(
      req.tenantDb,
      id,
      alertId,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Post('sessions/:id/intravisit/alerts/:alertId/acknowledge')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Acknowledge an intra-visit safety alert for SLA tracking' })
  @ApiResponse({ status: 200, description: 'Intra-visit alert acknowledged' })
  async acknowledgeIntraVisitAlert(
    @Param('id') id: string,
    @Param('alertId') alertId: string,
    @Body() body: AcknowledgePostVisitIntraVisitAlertDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.acknowledgeIntraVisitAlert(
      req.tenantDb,
      id,
      alertId,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Post('sessions/:id/documents/intelligence')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Upload a document for post-visit OCR intelligence extraction and FHIR mapping' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        documentType: {
          type: 'string',
          enum: ['lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'other'],
          default: 'other',
        },
        language: {
          type: 'string',
          default: 'en',
        },
        note: {
          type: 'string',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Document intelligence extracted and persisted' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        const allowedMimes = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'text/plain',
          'text/csv',
          'application/json',
        ];
        if (allowedMimes.includes(String(file.mimetype || '').toLowerCase())) {
          callback(null, true);
        } else {
          callback(
            new HttpException(
              `Invalid document file type. Allowed types: ${allowedMimes.join(', ')}`,
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }
      },
    }),
  )
  async ingestDocumentIntelligence(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: IngestPostVisitDocumentIntelligenceDto,
    @Request() req: RequestWithTenant,
  ): Promise<Record<string, any>> {
    if (!file) {
      throw new HttpException('Document file is required', HttpStatus.BAD_REQUEST);
    }
    await this.uploadSecurityService.assertCleanUpload(file, 'document');
    return this.postVisitService.ingestDocumentIntelligence(req.tenantDb, id, file, body, {
      actorUserId: this.resolveUserId(req),
      tenantId: req.tenantId,
    });
  }

  @Get('sessions/:id/documents/intelligence')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List post-visit document intelligence extracts for a session' })
  @ApiResponse({ status: 200, description: 'Document intelligence list fetched' })
  async listDocumentIntelligence(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('limit') limit?: string,
  ): Promise<Record<string, any>> {
    return this.postVisitService.listSessionDocumentIntelligence(req.tenantDb, id, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('sessions/:id/diarization')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Get diarization review segments and attribution confidence summary for a session' })
  @ApiResponse({ status: 200, description: 'Session diarization fetched' })
  async getSessionDiarization(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
    @Query('limit') limit?: string,
    @Query('unresolvedOnly') unresolvedOnly?: string,
  ) {
    return this.postVisitService.getSessionDiarization(req.tenantDb, id, {
      limit: limit ? Number(limit) : undefined,
      unresolvedOnly: ['1', 'true', 'yes'].includes(String(unresolvedOnly || '').toLowerCase()),
    });
  }

  @Post('sessions/:id/diarization/:segmentId/reassign')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Reassign transcript segment speaker attribution for diarization signoff' })
  @ApiResponse({ status: 200, description: 'Diarization segment reassigned' })
  async reassignDiarizationSegment(
    @Param('id') id: string,
    @Param('segmentId') segmentId: string,
    @Body() body: ReassignPostVisitDiarizationSegmentDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.reassignDiarizationSegment(
      req.tenantDb,
      id,
      segmentId,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Post('sessions/:id/recommendations/:actionId/execute')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Execute a recommendation bundle action into underlying workflows with idempotency' })
  @ApiResponse({ status: 200, description: 'Recommendation action executed (or reused if already executed)' })
  async executeRecommendationAction(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body() body: ExecutePostVisitRecommendationDto,
    @Request() req: RequestWithTenant,
    ) {
    return this.postVisitService.executeRecommendationAction(
      req.tenantDb,
      id,
      actionId,
      body,
      {
        tenantId: req.tenantId,
        actorUserId: this.resolveUserId(req),
        source: 'post_visit_execute_recommendation_endpoint',
      },
    );
  }

  @Get('sessions/:id/billing-intelligence')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Get post-visit billing intelligence suggestions and documentation sufficiency summary' })
  @ApiResponse({ status: 200, description: 'Billing intelligence fetched' })
  async getSessionBillingIntelligence(
    @Param('id') id: string,
    @Request() req: RequestWithTenant,
  ): Promise<any> {
    return this.postVisitService.getSessionBillingIntelligence(req.tenantDb, id);
  }

  @Post('sessions/:id/billing-suggestions/:suggestionId/review')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Approve or reject a post-visit billing suggestion with audit trail and accounts routing' })
  @ApiResponse({ status: 200, description: 'Billing suggestion reviewed' })
  async reviewBillingSuggestion(
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Body() body: ReviewPostVisitBillingSuggestionDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.reviewBillingSuggestion(
      req.tenantDb,
      id,
      suggestionId,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }

  @Get('appointments/:appointmentId/previsit-brief')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Generate or fetch appointment pre-visit AI brief with follow-up risk scoring' })
  @ApiResponse({ status: 200, description: 'Pre-visit brief fetched' })
  async getAppointmentPreVisitBrief(
    @Param('appointmentId') appointmentId: string,
    @Request() req: RequestWithTenant,
    @Query('refresh') refresh?: string,
  ): Promise<any> {
    return this.postVisitService.generateAppointmentPreVisitBrief(
      req.tenantDb,
      appointmentId,
      {
        actorUserId: this.resolveUserId(req),
        forceRefresh: ['1', 'true', 'yes', 'refresh'].includes(String(refresh || '').toLowerCase()),
      },
    );
  }

  @Post('sessions/:id/publish')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Publish doctor-approved post-visit summary/checklist for patient companion access' })
  @ApiResponse({ status: 200, description: 'Post-visit session published' })
  async publishSession(
    @Param('id') id: string,
    @Body() body: PublishPostVisitSessionDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.publishSession(
      req.tenantDb,
      id,
      body,
      {
        tenantId: req.tenantId,
        actorUserId: this.resolveUserId(req),
        source: 'post_visit_publish_endpoint',
      },
    );
  }

  @Post('escalation/classify')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Classify a post-visit patient message using escalation confidence pipeline v2' })
  @ApiResponse({ status: 200, description: 'Escalation classification completed' })
  async classifyEscalation(
    @Body() body: ClassifyPostVisitEscalationDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.classifyEscalation(req.tenantDb, body);
  }

  @Get('escalations')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List post-visit companion escalation events with SLA metadata' })
  @ApiResponse({ status: 200, description: 'Post-visit escalations fetched' })
  async getEscalations(
    @Request() req: RequestWithTenant,
    @Query('status') status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed',
    @Query('severity') severity?: 'low' | 'moderate' | 'high' | 'critical',
    @Query('routeTarget') routeTarget?: 'emergency' | 'doctor' | 'nurse',
    @Query('triggerType') triggerType?: string,
    @Query('temporality') temporality?: 'current' | 'historical' | 'unclear',
    @Query('minConfidence') minConfidence?: string,
    @Query('sessionId') sessionId?: string,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.postVisitService.listEscalations(
      req.tenantDb,
      {
        status,
        severity,
        routeTarget,
        triggerType: triggerType ? String(triggerType).trim() : undefined,
        temporality,
        minConfidence: minConfidence ? Number(minConfidence) : undefined,
        sessionId,
        patientId,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
    );
  }

  @Post('escalations/:id/resolve')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Resolve or dismiss a post-visit companion escalation event' })
  @ApiResponse({ status: 200, description: 'Post-visit escalation updated' })
  async resolveEscalation(
    @Param('id') id: string,
    @Body() body: ResolvePostVisitEscalationDto,
    @Request() req: RequestWithTenant,
  ) {
    return this.postVisitService.resolveEscalation(
      req.tenantDb,
      id,
      body,
      {
        actorUserId: this.resolveUserId(req),
      },
    );
  }
}
