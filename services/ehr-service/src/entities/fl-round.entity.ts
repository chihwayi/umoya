import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fl_rounds')
export class FlRound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'round_number' })
  roundNumber: number;

  @Column({ name: 'global_model_version' })
  globalModelVersion: string;

  @Column({ name: 'model_type' }) // deterioration | readmission | sepsis
  modelType: string;

  @Column({ name: 'participating_tenants', type: 'jsonb', default: '[]' })
  participatingTenants: string[];

  @Column({ name: 'aggregated_metrics', type: 'jsonb', default: '{}' })
  aggregatedMetrics: Record<string, any>;

  @Column({ name: 'model_weights_ref', nullable: true })
  modelWeightsRef: string;

  @Column({ default: 'pending' }) // pending | aggregating | completed | failed
  status: string;

  @CreateDateColumn({ name: 'initiated_at' })
  initiatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;
}
