import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ClinicalKnowledgeDocument } from '../entities/clinical-knowledge-document.entity';
import { CdssService } from './cdss.service';
import { MinioService } from './minio.service';
import { TenantService } from './tenant.service';

/** Documents surviving past this many minutes without reaching a terminal status
 * ('completed'/'failed') are treated as stuck — see detectStuckIngestions below. */
const STUCK_INGESTION_THRESHOLD_MINUTES = 30;

@Injectable()
export class KnowledgeIngestService {
  private readonly logger = new Logger(KnowledgeIngestService.name);

  constructor(
    private readonly cdssService: CdssService,
    private readonly minioService: MinioService,
    @Optional() private readonly tenantService?: TenantService,
  ) {}

  async ingestDocument(
    file: Express.Multer.File,
    metadata: {
      title: string;
      documentType: string;
      specialty?: string;
      sourceOrganization?: string;
      version?: string;
      effectiveDate?: string;
      language?: string;
    },
    uploadedBy: string,
    tenantId: string,
    tenantDb: DataSource,
  ): Promise<ClinicalKnowledgeDocument> {
    const minioKey = `clinical-knowledge/${tenantId}/${Date.now()}-${file.originalname}`;
    await this.minioService.uploadBuffer('clinical-knowledge', minioKey, file.buffer, file.mimetype);

    const docRepo = tenantDb.getRepository(ClinicalKnowledgeDocument);
    const doc = await docRepo.save({
      tenantId,
      title: metadata.title,
      documentType: metadata.documentType,
      specialty: metadata.specialty,
      sourceOrganization: metadata.sourceOrganization,
      version: metadata.version,
      effectiveDate: metadata.effectiveDate ? new Date(metadata.effectiveDate) : undefined,
      language: metadata.language || 'en',
      minioBucket: 'clinical-knowledge',
      minioKey,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      ingestionStatus: 'pending',
      uploadedBy,
    });

    this.runIngestion(doc, file.buffer, tenantId, tenantDb).catch(err => {
      this.logger.error(`Ingestion failed for document ${doc.id}: ${err.message}`);
    });

    return doc;
  }

  async listDocuments(tenantId: string, tenantDb: DataSource): Promise<ClinicalKnowledgeDocument[]> {
    const docRepo = tenantDb.getRepository(ClinicalKnowledgeDocument);
    return docRepo.find({ where: { tenantId, isActive: true }, order: { createdAt: 'DESC' } });
  }

  async deactivateDocument(id: string, tenantId: string, tenantDb: DataSource): Promise<void> {
    const docRepo = tenantDb.getRepository(ClinicalKnowledgeDocument);
    await docRepo.update({ id, tenantId }, { isActive: false });
  }

  private async runIngestion(doc: ClinicalKnowledgeDocument, fileBuffer: Buffer, tenantId: string, tenantDb: DataSource) {
    const docRepo = tenantDb.getRepository(ClinicalKnowledgeDocument);
    try {
      await docRepo.update(doc.id, { ingestionStatus: 'processing' });

      const result = await this.cdssService.ingestKnowledgeDocument({
        documentId: doc.id,
        tenantId,
        fileBase64: fileBuffer.toString('base64'),
        mimeType: doc.mimeType || 'application/octet-stream',
        metadata: {
          title: doc.title,
          documentType: doc.documentType,
          specialty: doc.specialty,
          sourceOrganization: doc.sourceOrganization,
        },
      });

      await docRepo.update(doc.id, {
        ingestionStatus: 'completed',
        chunkCount: result.chunkCount,
        embeddingModel: result.embeddingModel,
        ingestedAt: new Date(),
      });
    } catch (err: any) {
      // F17 investigation (S272): the document already reaches a real terminal
      // 'failed' state here — the roadmap finding that it "stays pending forever"
      // was inaccurate against this code. The one genuine residual gap: if this
      // failure-recording write itself throws (a secondary DB failure while
      // recording the primary one), the document would be silently stuck with
      // only the outer .catch()'s single log line in ingestDocument() above. Guard
      // against that specifically, and detectStuckIngestions() below is the real
      // safety net for it.
      try {
        await docRepo.update(doc.id, {
          ingestionStatus: 'failed',
          ingestionError: err.message,
        });
      } catch (writeErr: any) {
        this.logger.error(
          `Ingestion failed for document ${doc.id} AND recording that failure also failed — ` +
          `document may be stuck without a terminal status until the stuck-ingestion sweep catches it. ` +
          `Original error: ${err.message}. Write error: ${writeErr.message}`,
        );
      }
    }
  }

  /** Safety net for the narrow double-failure case above (and any other path that
   * could leave a document stuck): finds documents that have sat in 'pending' or
   * 'processing' past the threshold and marks them 'failed' so they surface in the
   * UI (KnowledgeBasePage.tsx already renders 'failed' distinctly) instead of
   * silently looking like ingestion is still in progress forever. */
  async detectStuckIngestions(tenantId: string, tenantDb: DataSource): Promise<number> {
    const docRepo = tenantDb.getRepository(ClinicalKnowledgeDocument);
    const cutoff = new Date(Date.now() - STUCK_INGESTION_THRESHOLD_MINUTES * 60 * 1000);
    const stuck = await docRepo
      .createQueryBuilder()
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('ingestion_status IN (:...statuses)', { statuses: ['pending', 'processing'] })
      .andWhere('created_at < :cutoff', { cutoff })
      .getMany();

    for (const doc of stuck) {
      await docRepo.update(doc.id, {
        ingestionStatus: 'failed',
        ingestionError: `Ingestion stuck in '${doc.ingestionStatus}' for over ${STUCK_INGESTION_THRESHOLD_MINUTES} minutes — marked failed by stuck-ingestion sweep`,
      });
      this.logger.error(`Knowledge document ${doc.id} (tenant ${tenantId}) was stuck in '${doc.ingestionStatus}' — marked failed by sweep`);
    }

    return stuck.length;
  }

  @Cron('*/10 * * * *')
  async sweepStuckIngestions(): Promise<void> {
    if (!this.tenantService) return;
    let tenants: any[] = [];
    try {
      tenants = (await this.tenantService.getAllActiveTenants()) ?? [];
    } catch (e: any) {
      this.logger.error(`Stuck-ingestion sweep: getAllActiveTenants() failed: ${e?.message}`);
      return;
    }

    for (const tenant of tenants) {
      const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
      if (!subdomain) continue;
      try {
        const tenantDb = await this.tenantService.getTenantDatabase(subdomain);
        if (!tenantDb) continue;
        await this.detectStuckIngestions(subdomain, tenantDb);
      } catch (e: any) {
        this.logger.error(`Stuck-ingestion sweep failed for tenant ${subdomain}: ${e?.message}`);
      }
    }
  }
}
