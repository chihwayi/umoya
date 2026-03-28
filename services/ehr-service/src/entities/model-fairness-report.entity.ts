import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('model_fairness_reports')
export class ModelFairnessReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'model_name' })
  modelName: string;

  @Column({ name: 'evaluation_period' })
  evaluationPeriod: string;

  @Column({ name: 'dimension' }) // gender | age_group | ethnicity
  dimension: string;

  @Column({ name: 'group_metrics', type: 'jsonb', default: '{}' })
  // { male: { auc, n }, female: { auc, n }, ... }
  groupMetrics: Record<string, { auc: number; n: number; brier?: number }>;

  @Column({ name: 'max_disparity', type: 'float', nullable: true })
  maxDisparity: number;

  @Column({ name: 'fairness_flag', default: false })
  // True if max_disparity > 0.05 (5% AUC gap)
  fairnessFlag: boolean;

  @CreateDateColumn({ name: 'computed_at' })
  computedAt: Date;
}
