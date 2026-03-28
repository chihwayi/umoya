import { Controller, Post, Get, Delete, Param, Body, UseInterceptors, UploadedFile, UseGuards, Request } from '@nestjs/common';
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
}
