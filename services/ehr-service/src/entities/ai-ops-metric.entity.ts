import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('ai_ops_metrics')
export class AiOpsMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surface', type: 'varchar', length: 100 })
  @Index()
  surface: string;

  @Column({ name: 'metric_date', type: 'date' })
  @Index()
  metricDate: string;

  @Column({ name: 'total_calls', type: 'int', default: 0 })
  totalCalls: number;

  @Column({ name: 'abstention_count', type: 'int', default: 0 })
  abstentionCount: number;

  @Column({ name: 'circuit_breaker_trips', type: 'int', default: 0 })
  circuitBreakerTrips: number;

  @Column({ name: 'avg_latency_ms', type: 'decimal', precision: 8, scale: 2, nullable: true })
  avgLatencyMs: number | null;

  @Column({ name: 'p95_latency_ms', type: 'decimal', precision: 8, scale: 2, nullable: true })
  p95LatencyMs: number | null;

  @Column({ name: 'accuracy', type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracy: number | null;

  @Column({ name: 'fairness_age_parity', type: 'decimal', precision: 5, scale: 4, nullable: true })
  fairnessAgeParity: number | null;

  @Column({ name: 'fairness_gender_parity', type: 'decimal', precision: 5, scale: 4, nullable: true })
  fairnessGenderParity: number | null;

  @Column({ name: 'fairness_sdoh_parity', type: 'decimal', precision: 5, scale: 4, nullable: true })
  fairnessSdohParity: number | null;

  @Column({ name: 'consent_block_count', type: 'int', default: 0 })
  consentBlockCount: number;

  @Column({ name: 'override_count', type: 'int', default: 0 })
  overrideCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
