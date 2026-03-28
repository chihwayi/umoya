import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('insurance_ocr_results')
export class InsuranceOcrResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  @Index()
  patientId: string | null;

  @Column({ name: 'session_token', type: 'varchar', length: 100 })
  sessionToken: string;

  @Column({ name: 'minio_object_key', type: 'varchar', length: 500 })
  minioObjectKey: string;

  @Column({ name: 'member_id', type: 'varchar', length: 100, nullable: true })
  memberId: string | null;

  @Column({ name: 'group_number', type: 'varchar', length: 100, nullable: true })
  groupNumber: string | null;

  @Column({ name: 'plan_name', type: 'varchar', length: 200, nullable: true })
  planName: string | null;

  @Column({ name: 'payer_name', type: 'varchar', length: 200, nullable: true })
  payerName: string | null;

  @Column({ name: 'effective_date', type: 'varchar', length: 20, nullable: true })
  effectiveDate: string | null;

  @Column({ name: 'expiry_date', type: 'varchar', length: 20, nullable: true })
  expiryDate: string | null;

  @Column({ name: 'raw_ocr_json', type: 'jsonb', default: {} })
  rawOcrJson: Record<string, unknown>;

  @Column({ name: 'confidence', type: 'decimal', precision: 5, scale: 4, default: 0 })
  confidence: number;

  @Column({ name: 'manually_corrected', type: 'boolean', default: false })
  manuallyCorrected: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
