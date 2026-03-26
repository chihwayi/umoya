import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('registration_document_extracts')
export class RegistrationDocumentExtract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string | null;

  @Column({ name: 'document_type', type: 'varchar', length: 50 })
  documentType: string;

  @Column({ name: 'document_name', type: 'varchar', length: 255 })
  documentName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType?: string | null;

  @Column({ name: 'file_size', type: 'int', default: 0 })
  fileSize: number;

  @Column({ name: 'file_sha256', type: 'varchar', length: 64, nullable: true })
  fileSha256?: string | null;

  @Column({ name: 'extraction_status', type: 'varchar', length: 30, default: 'processed' })
  extractionStatus: string;

  @Column({ name: 'ocr_engine', type: 'varchar', length: 60, nullable: true })
  ocrEngine?: string | null;

  @Column({ name: 'ocr_confidence', type: 'decimal', precision: 5, scale: 4, nullable: true })
  ocrConfidence?: number | null;

  @Column({ name: 'extracted_text', type: 'text', nullable: true })
  extractedText?: string | null;

  @Column({ name: 'structured_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  structuredPayload: Record<string, any>;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
