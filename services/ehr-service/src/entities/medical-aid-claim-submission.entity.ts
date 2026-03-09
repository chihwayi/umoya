import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('medical_aid_claim_submissions')
export class MedicalAidClaimSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @Index()
  @Column({ name: 'provider_id', type: 'uuid', nullable: true })
  providerId: string | null;

  @Column({ name: 'claim_number', length: 100, nullable: true })
  claimNumber: string | null;

  @Column({ length: 30, default: 'draft' })
  status: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'paid' | 'error';

  @Column({ name: 'submission_format', length: 50, default: 'stub' })
  submissionFormat: string;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  response: Record<string, any>;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

