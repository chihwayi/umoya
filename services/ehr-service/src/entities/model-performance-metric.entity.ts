import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('model_performance_metrics')
export class ModelPerformanceMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'model_name' }) // deterioration | readmission | sepsis | no_show
  modelName: string;

  @Column({ name: 'evaluation_period' }) // 2026-03 (monthly)
  evaluationPeriod: string;

  @Column({ name: 'sample_count', default: 0 })
  sampleCount: number;

  @Column({ name: 'auc_roc', type: 'float', nullable: true })
  aucRoc: number;

  @Column({ name: 'brier_score', type: 'float', nullable: true })
  brierScore: number;

  @Column({ name: 'sensitivity', type: 'float', nullable: true })
  sensitivity: number;

  @Column({ name: 'specificity', type: 'float', nullable: true })
  specificity: number;

  @Column({ name: 'ppv', type: 'float', nullable: true })
  ppv: number;

  @Column({ name: 'calibration_data', type: 'jsonb', nullable: true })
  // [{ decile, predicted_rate, actual_rate }]
  calibrationData: Array<{ decile: number; predictedRate: number; actualRate: number }>;

  @Column({ name: 'drift_detected', default: false })
  driftDetected: boolean;

  @Column({ name: 'baseline_auc', type: 'float', nullable: true })
  baselineAuc: number;

  @CreateDateColumn({ name: 'computed_at' })
  computedAt: Date;
}
