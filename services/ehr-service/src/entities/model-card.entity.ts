import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('model_cards')
export class ModelCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'model_name', unique: true })
  modelName: string;

  @Column({ name: 'model_family', default: 'local_ml' })
  modelFamily: string;

  @Column({ name: 'latest_registry_id', nullable: true })
  latestRegistryId: string | null;

  @Column({ name: 'current_version', nullable: true })
  currentVersion: string | null;

  @Column({ name: 'deployment_stage', default: 'development' })
  deploymentStage: string;

  @Column({ name: 'intended_use', type: 'text', nullable: true })
  intendedUse: string | null;

  @Column({ name: 'limitations', type: 'text', nullable: true })
  limitations: string | null;

  @Column({ name: 'clinical_scope', type: 'text', nullable: true })
  clinicalScope: string | null;

  @Column({ name: 'training_summary', type: 'jsonb', default: '{}' })
  trainingSummary: Record<string, any>;

  @Column({ name: 'evaluation_summary', type: 'jsonb', default: '{}' })
  evaluationSummary: Record<string, any>;

  @Column({ name: 'governance_summary', type: 'jsonb', default: '{}' })
  governanceSummary: Record<string, any>;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
