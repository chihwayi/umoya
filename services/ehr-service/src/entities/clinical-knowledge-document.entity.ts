import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('clinical_knowledge_documents')
export class ClinicalKnowledgeDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', length: 100 }) tenantId: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'document_type', length: 50 }) documentType: string;
  @Column({ length: 100, nullable: true }) specialty?: string;
  @Column({ name: 'source_organization', length: 255, nullable: true }) sourceOrganization?: string;
  @Column({ length: 50, nullable: true }) version?: string;
  @Column({ name: 'effective_date', type: 'date', nullable: true }) effectiveDate?: Date;
  @Column({ name: 'expiry_date', type: 'date', nullable: true }) expiryDate?: Date;
  @Column({ length: 10, default: 'en' }) language: string;
  @Column({ name: 'minio_bucket', length: 100 }) minioBucket: string;
  @Column({ name: 'minio_key', type: 'text' }) minioKey: string;
  @Column({ name: 'file_size_bytes', nullable: true }) fileSizeBytes?: number;
  @Column({ name: 'mime_type', length: 100, nullable: true }) mimeType?: string;
  @Column({ name: 'chunk_count', default: 0 }) chunkCount: number;
  @Column({ name: 'embedding_model', length: 100, nullable: true }) embeddingModel?: string;
  @Column({ name: 'ingestion_status', length: 30, default: 'pending' }) ingestionStatus: string;
  @Column({ name: 'ingestion_error', type: 'text', nullable: true }) ingestionError?: string;
  @Column({ name: 'ingested_at', type: 'timestamptz', nullable: true }) ingestedAt?: Date;
  @Column({ name: 'uploaded_by', type: 'uuid' }) uploadedBy: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
