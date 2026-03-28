import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dicom_studies')
export class DicomStudy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'imaging_order_id', nullable: true })
  imagingOrderId: string;

  @Column({ name: 'study_uid', unique: true })
  studyUid: string;

  @Column({ name: 'modality' }) // CXR | FUNDUS | DERM | CT | MRI | US
  modality: string;

  @Column({ name: 'body_part', nullable: true })
  bodyPart: string;

  @Column({ name: 'storage_key' }) // path in object storage
  storageKey: string;

  @Column({ name: 'file_size_bytes', default: 0 })
  fileSizeBytes: number;

  @Column({ name: 'ai_analysis_requested', default: false })
  aiAnalysisRequested: boolean;

  @Column({ name: 'ai_analysis_status', default: 'pending' }) // pending | processing | complete | failed
  aiAnalysisStatus: string;

  @Column({ name: 'acquired_at', type: 'timestamptz', nullable: true })
  acquiredAt: Date;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
