import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

export type DocumentType = 'id_card' | 'insurance_card' | 'medical_report' | 'lab_result' | 'imaging_result' | 'prescription' | 'certificate' | 'other';

@Entity('patient_documents')
export class PatientDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'document_type', type: 'varchar', length: 50 })
  documentType: DocumentType;

  @Column({ name: 'document_name', type: 'varchar', length: 255 })
  documentName: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath?: string;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl?: string;

  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize?: number;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string;

  @Column({ name: 'uploaded_at', type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

