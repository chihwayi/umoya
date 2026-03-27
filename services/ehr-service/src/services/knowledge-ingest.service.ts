import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClinicalKnowledgeDocument } from '../entities/clinical-knowledge-document.entity';
import { CdssService } from './cdss.service';
import { MinioService } from './minio.service';

@Injectable()
export class KnowledgeIngestService {
  private readonly logger = new Logger(KnowledgeIngestService.name);

  constructor(
    private readonly cdssService: CdssService,
    private readonly minioService: MinioService,
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
      await docRepo.update(doc.id, {
        ingestionStatus: 'failed',
        ingestionError: err.message,
      });
    }
  }
}
