import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fl_participation_logs')
export class FlParticipationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'round_id' })
  roundId: string;

  @Column({ name: 'tenant_subdomain' })
  tenantSubdomain: string;

  @Column({ name: 'local_model_metrics', type: 'jsonb', default: '{}' })
  localModelMetrics: Record<string, any>;

  @Column({ name: 'sample_count', default: 0 })
  sampleCount: number;

  @Column({ name: 'gradient_norm', type: 'float', nullable: true })
  gradientNorm: number;

  @Column({ name: 'privacy_epsilon', type: 'float', nullable: true })
  privacyEpsilon: number;

  @Column({ default: 'submitted' }) // submitted | accepted | rejected
  status: string;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;
}
