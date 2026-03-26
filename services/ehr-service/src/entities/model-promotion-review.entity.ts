import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('model_promotion_reviews')
export class ModelPromotionReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'model_registry_id' })
  modelRegistryId: string;

  @Column({ name: 'model_name' })
  modelName: string;

  @Column({ name: 'candidate_version' })
  candidateVersion: string;

  @Column({ name: 'requested_stage' })
  requestedStage: string;

  @Column({ name: 'review_status', default: 'pending_review' })
  reviewStatus: string;

  @Column({ name: 'requested_by', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'decision_by', nullable: true })
  decisionBy: string | null;

  @Column({ name: 'decision_notes', type: 'text', nullable: true })
  decisionNotes: string | null;

  @Column({ name: 'metric_summary', type: 'jsonb', default: '{}' })
  metricSummary: Record<string, any>;

  @Column({ name: 'shadow_validation_passed', default: false })
  shadowValidationPassed: boolean;

  @Column({ name: 'calibration_passed', default: false })
  calibrationPassed: boolean;

  @Column({ name: 'fairness_passed', default: false })
  fairnessPassed: boolean;

  @Column({ name: 'rollback_ready', default: false })
  rollbackReady: boolean;

  @Column({ name: 'clinical_approval', default: false })
  clinicalApproval: boolean;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
