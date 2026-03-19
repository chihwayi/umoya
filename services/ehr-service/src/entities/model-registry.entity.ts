import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('model_registry')
export class ModelRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'model_name' }) // deterioration | readmission | sepsis | no_show
  modelName: string;

  @Column({ name: 'version' }) // v1, v2, v3 ...
  version: string;

  @Column({ name: 'round_id', nullable: true }) // fl_rounds.id that produced this
  roundId: string;

  @Column({ default: 'staging' }) // staging | production | retired | rejected
  status: string;

  @Column({ name: 'minio_path' }) // models/deterioration/v3/weights.pkl
  minioPath: string;

  @Column({ name: 'auc_roc', type: 'float', nullable: true })
  aucRoc: number;

  @Column({ name: 'brier_score', type: 'float', nullable: true })
  brierScore: number;

  @Column({ name: 'sample_count', default: 0 })
  sampleCount: number;

  @Column({ name: 'tenant_count', default: 0 })
  // Number of tenants that contributed to this round
  tenantCount: number;

  @Column({ name: 'model_hash', nullable: true }) // SHA-256 of weights file
  modelHash: string;

  @Column({ name: 'feature_names', type: 'jsonb', default: '[]' })
  featureNames: string[];

  @Column({ name: 'framework', default: 'sklearn' }) // sklearn | onnx | pytorch
  framework: string;

  @Column({ name: 'promoted_at', type: 'timestamptz', nullable: true })
  promotedAt: Date;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
