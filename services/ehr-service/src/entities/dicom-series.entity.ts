import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('dicom_series')
export class DicomSeries {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'imaging_order_id', type: 'uuid' })
  @Index()
  imagingOrderId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'study_instance_uid', type: 'varchar', length: 200 })
  studyInstanceUid: string;

  @Column({ name: 'series_instance_uid', type: 'varchar', length: 200 })
  seriesInstanceUid: string;

  @Column({ name: 'modality', type: 'varchar', length: 20, default: 'CT' })
  modality: string;

  @Column({ name: 'series_description', type: 'text', nullable: true })
  seriesDescription: string | null;

  @Column({ name: 'instance_count', type: 'int', default: 0 })
  instanceCount: number;

  @Column({ name: 'minio_prefix', type: 'varchar', length: 500 })
  minioPrefix: string;

  @Column({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
