import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('cdss_feedback_entries')
export class CdssFeedbackEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'log_id', type: 'varchar', length: 255, nullable: true })
  logId?: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string;

  @Column({ name: 'decision_type', type: 'varchar', length: 60 })
  decisionType: string;

  @Column({ name: 'top_recommendation', type: 'text', nullable: true })
  topRecommendation?: string;

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidenceScore?: number;

  @Column({ name: 'clinician_action', type: 'varchar', length: 20, nullable: true })
  clinicianAction?: string;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason?: string;

  @Column({ name: 'outcome_at_30_days', type: 'jsonb', nullable: true })
  outcomeAt30Days?: Record<string, any>;

  @Column({ name: 'outcome_at_90_days', type: 'jsonb', nullable: true })
  outcomeAt90Days?: Record<string, any>;

  @Column({ name: 'feedback_status', type: 'varchar', length: 30, default: 'pending_review' })
  feedbackStatus: string;

  @Column({ name: 'claimed_for_learning', type: 'boolean', default: false })
  claimedForLearning: boolean;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
