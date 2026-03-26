import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('model_shadow_evaluations')
export class ModelShadowEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'model_name' })
  modelName: string;

  @Column({ name: 'evaluation_kind', default: 'governed_shadow' })
  evaluationKind: string;

  @Column({ name: 'evaluation_status', default: 'review_pending' })
  evaluationStatus: string;

  @Column({ name: 'candidate_registry_id', nullable: true })
  candidateRegistryId: string | null;

  @Column({ name: 'candidate_version', nullable: true })
  candidateVersion: string | null;

  @Column({ name: 'production_registry_id', nullable: true })
  productionRegistryId: string | null;

  @Column({ name: 'production_version', nullable: true })
  productionVersion: string | null;

  @Column({ name: 'fl_round_id', nullable: true })
  flRoundId: string | null;

  @Column({ name: 'source_job_count', default: 0 })
  sourceJobCount: number;

  @Column({ name: 'source_job_ids', type: 'jsonb', default: '[]' })
  sourceJobIds: string[];

  @Column({ name: 'summary', type: 'jsonb', default: '{}' })
  summary: Record<string, any>;

  @Column({ name: 'requested_by', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'decision_notes', type: 'text', nullable: true })
  decisionNotes: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
