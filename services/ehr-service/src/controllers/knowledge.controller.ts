import { Controller, Post, Get, Delete, Param, Body, Query, UseInterceptors, UploadedFile, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { KnowledgeIngestService } from '../services/knowledge-ingest.service';
import { CdssService } from '../services/cdss.service';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@ApiTags('Clinical Knowledge Base')
@ApiSecurity('tenant-key')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeIngestService,
    private readonly cdssService: CdssService,
  ) {}

  @Post('documents')
  @UseGuards(RolesGuard)
  @Roles('admin', 'doctor', 'senior_clinician')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload and ingest a clinical knowledge document' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: {
      title: string;
      documentType: string;
      specialty?: string;
      sourceOrganization?: string;
      version?: string;
      effectiveDate?: string;
    },
    @Request() req: RequestWithTenant,
  ) {
    const uploadedBy = req.user?.id || req.user?.sub || 'system';
    const tenantId = req.tenantId || 'default';
    return this.knowledgeService.ingestDocument(file, metadata, uploadedBy, tenantId, req.tenantDb);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List clinical knowledge documents' })
  async listDocuments(@Request() req: RequestWithTenant) {
    const tenantId = req.tenantId || 'default';
    return this.knowledgeService.listDocuments(tenantId, req.tenantDb);
  }

  @Delete('documents/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate a clinical knowledge document' })
  async deleteDocument(@Param('id') id: string, @Request() req: RequestWithTenant) {
    const tenantId = req.tenantId || 'default';
    return this.knowledgeService.deactivateDocument(id, tenantId, req.tenantDb);
  }

  /**
   * Mobile guideline search — proxies to CDSS searchGuidelines.
   * Called by mobile CdssService.guidelineSearch().
   */
  @Post('search')
  @ApiOperation({ summary: 'Search clinical guidelines (mobile)' })
  async searchGuidelines(
    @Body() body: { query: string; top_k?: number; surface?: string },
    @Request() req: RequestWithTenant,
  ) {
    const results = await this.cdssService.searchGuidelines(
      body.query,
      body.top_k ?? 5,
      { module: body.surface ?? 'mobile_guidelines' },
      req.tenantId ?? 'default',
      req.tenantDb,
    );
    const list = (results as unknown as any[]) ?? [];
    return { results: list, abstained: list.length === 0 };
  }

  // ── Corpus coverage & ingestion status (admin) ──────────────────────────

  @Get('corpus/coverage')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get CDSS corpus domain coverage and gap analysis' })
  async corpusCoverage(@Request() req: RequestWithTenant) {
    return this.cdssService.getCorpusCoverage(req.user?.sub ?? 'admin');
  }

  @Get('corpus/documents')
  @UseGuards(RolesGuard)
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'List all documents ingested into the CDSS RAG corpus' })
  async corpusDocuments(@Query('domain') domain: string, @Request() req: RequestWithTenant) {
    return this.cdssService.getCorpusDocuments(req.user?.sub ?? 'admin', domain || undefined);
  }

  @Get('corpus/stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'CDSS corpus quick stats: chunk count, BM25 status, embedding model' })
  async corpusStats(@Request() req: RequestWithTenant) {
    return this.cdssService.getCorpusStats(req.user?.sub ?? 'admin');
  }

  @Get('ingest/jobs')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'List recent CDSS ingestion jobs with status' })
  async ingestJobs(@Query('limit') limit: string, @Request() req: RequestWithTenant) {
    return this.cdssService.getIngestJobs(req.user?.sub ?? 'admin', limit ? Number(limit) : 20);
  }

  @Get('ingest/status/:jobId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get live status of a specific ingestion job' })
  async ingestStatus(@Param('jobId') jobId: string, @Request() req: RequestWithTenant) {
    return this.cdssService.getIngestStatus(jobId);
  }

  @Get('ingest/history')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Full ingestion history with file-level detail' })
  async ingestHistory(
    @Query('limit') limit: string,
    @Query('query') query: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.cdssService.getIngestHistory(req.user?.sub ?? 'admin', limit ? Number(limit) : 100, query || undefined);
  }
}
