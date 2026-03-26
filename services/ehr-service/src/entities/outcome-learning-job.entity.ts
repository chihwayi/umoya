import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('outcome_learning_jobs')
export class OutcomeLearningJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'feedback_log_id', unique: true })
  feedbackLogId: string;

  @Column({ name: 'tenant_subdomain' })
  tenantSubdomain: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'decision_type' })
  decisionType: string;

  @Column({ name: 'model_name' })
  modelName: string;

  @Column({ name: 'job_status', default: 'claimed' })
  jobStatus: string;

  @Column({ name: 'source_kind', default: 'outcome_feedback' })
  sourceKind: string;

  @Column({ name: 'claim_batch_id', nullable: true })
  claimBatchId: string | null;

  @Column({ name: 'processing_notes', type: 'text', nullable: true })
  processingNotes: string | null;

  @Column({ name: 'payload', type: 'jsonb', default: '{}' })
  payload: Record<string, any>;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @Column({ name: 'queued_at', type: 'timestamptz', nullable: true })
  queuedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
