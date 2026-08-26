import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('model_deployments')
export class ModelDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surface', type: 'varchar', length: 100 })
  surface: string;

  @Column({ name: 'model_version', type: 'varchar', length: 50 })
  modelVersion: string;

  @Column({ name: 'previous_version', type: 'varchar', length: 50, nullable: true })
  previousVersion: string | null;

  @Column({ name: 'eval_run_id', type: 'uuid' })
  evalRunId: string;

  @Column({ name: 'release_gate_id', type: 'uuid' })
  releaseGateId: string;

  @Column({ name: 'accuracy_before', type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracyBefore: number | null;

  @Column({ name: 'accuracy_after', type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracyAfter: number | null;

  @Column({ name: 'deployed_by_user_id', type: 'uuid', nullable: true })
  deployedByUserId: string | null;

  @Column({ name: 'deployment_method', type: 'varchar', length: 50, default: 'auto' })
  deploymentMethod: 'auto' | 'manual' | 'manual_review_required';

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'deployed' })
  status: 'deployed' | 'rolled_back' | 'failed' | 'feedback_queued';

  @Column({ name: 'rollback_reason', type: 'text', nullable: true })
  rollbackReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
