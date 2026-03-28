import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('claim_risk_scores')
export class ClaimRiskScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  @Index()
  claimId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  @Column({ name: 'risk_score', type: 'decimal', precision: 5, scale: 4 })
  riskScore: number;

  @Column({ name: 'confidence', type: 'decimal', precision: 5, scale: 4 })
  confidence: number;

  @Column({ name: 'top_reasons', type: 'jsonb', default: [] })
  topReasons: Array<{ code: string; description: string; weight: number }>;

  @Column({ name: 'model_version', type: 'varchar', length: 50 })
  modelVersion: string;

  @Column({ name: 'feature_snapshot', type: 'jsonb', default: {} })
  featureSnapshot: Record<string, unknown>;

  @Column({ name: 'threshold_action', type: 'varchar', length: 20, default: 'allow' })
  thresholdAction: 'allow' | 'warn' | 'block';

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string | null;

  @Column({ name: 'override_user_id', type: 'uuid', nullable: true })
  overrideUserId: string | null;

  @Column({ name: 'actual_outcome', type: 'varchar', length: 30, nullable: true })
  actualOutcome: 'approved' | 'denied' | 'partial' | 'appealed' | null;

  @Column({ name: 'feedback_recorded_at', type: 'timestamptz', nullable: true })
  feedbackRecordedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
