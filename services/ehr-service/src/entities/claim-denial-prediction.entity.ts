import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('claim_denial_predictions')
@Index('idx_claim_denial_predictions_claim_id', ['claimId'])
@Index('idx_claim_denial_predictions_risk_level', ['riskLevel'])
export class ClaimDenialPrediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  claimId: string;

  @Column({ name: 'risk_score', type: 'decimal', precision: 5, scale: 2 })
  riskScore: number;

  @Column({ name: 'risk_level', type: 'varchar', length: 30 })
  riskLevel: string;

  @Column({ name: 'blockers_count', type: 'integer', default: 0 })
  blockersCount: number;

  @Column({ name: 'warnings_count', type: 'integer', default: 0 })
  warningsCount: number;

  @Column({ name: 'missing_documents_count', type: 'integer', default: 0 })
  missingDocumentsCount: number;

  @Column({ name: 'drivers', type: 'jsonb', default: () => "'[]'::jsonb" })
  drivers: Array<Record<string, any>>;

  @Column({ name: 'recommended_actions', type: 'jsonb', default: () => "'[]'::jsonb" })
  recommendedActions: string[];

  @Column({ name: 'model_version', type: 'varchar', length: 50, default: 'rules.v1' })
  modelVersion: string;

  @Column({ name: 'predicted_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  predictedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
