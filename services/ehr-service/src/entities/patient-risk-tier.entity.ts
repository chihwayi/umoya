import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type RiskTier = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

@Entity('patient_risk_tiers')
export class PatientRiskTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: false })
  @Index()
  patientId: string;

  @Column({ name: 'tier', type: 'varchar', length: 20 })
  @Index()
  tier: RiskTier;

  @Column({ name: 'composite_score', type: 'decimal', precision: 5, scale: 4 })
  compositeScore: number;

  @Column({ name: 'chronic_condition_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  chronicConditionScore: number;

  @Column({ name: 'vitals_trend_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  vitalsTrendScore: number;

  @Column({ name: 'adherence_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  adherenceScore: number;

  @Column({ name: 'sdoh_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  sdohScore: number;

  @Column({ name: 'no_show_rate', type: 'decimal', precision: 5, scale: 4, default: 0 })
  noShowRate: number;

  @Column({ name: 'lab_trend_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  labTrendScore: number;

  @Column({ name: 'contributing_factors', type: 'jsonb', default: [] })
  contributingFactors: Array<{ factor: string; weight: number; value: string }>;

  @Column({ name: 'recommended_actions', type: 'jsonb', default: [] })
  recommendedActions: Array<{ action: string; priority: number; dueWithinDays: number }>;

  @Column({ name: 'model_version', type: 'varchar', length: 50, default: 'v1.0.0' })
  modelVersion: string;

  @Column({ name: 'batch_run_id', type: 'uuid', nullable: true })
  batchRunId: string | null;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
