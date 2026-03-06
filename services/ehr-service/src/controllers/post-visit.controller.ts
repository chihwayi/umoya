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
  CreatePostVisitSessionDto,
  PublishPostVisitSessionDto,
  ResolvePostVisitEscalationDto,
  ExecutePostVisitRecommendationDto,
  RegeneratePostVisitDraftDto,
  ReviewPostVisitArtifactDto,
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
  async getSessionDraft(@Param('id') id: string, @Request() req: RequestWithTenant) {
    return this.postVisitService.getSessionDraft(req.tenantDb, id);
  }

  @Post('sessions/:id/draft/regenerate')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'Regenerate structured post-visit draft artifacts from transcript + patient context' })
  @ApiResponse({ status: 200, description: 'Post-visit draft regenerated' })
  async regenerateDraft(
    @Param('id') id: string,
    @Body() body: RegeneratePostVisitDraftDto,
    @Request() req: RequestWithTenant,
  ) {
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
  ) {
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

  @Get('escalations')
  @Roles('doctor', 'nurse', 'admin')
  @ApiOperation({ summary: 'List post-visit companion escalation events with SLA metadata' })
  @ApiResponse({ status: 200, description: 'Post-visit escalations fetched' })
  async getEscalations(
    @Request() req: RequestWithTenant,
    @Query('status') status?: 'open' | 'acknowledged' | 'resolved' | 'dismissed',
    @Query('severity') severity?: 'low' | 'moderate' | 'high' | 'critical',
    @Query('routeTarget') routeTarget?: 'emergency' | 'doctor' | 'nurse',
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
