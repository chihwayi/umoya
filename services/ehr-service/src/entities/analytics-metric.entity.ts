import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MetricCategory {
  FINANCIAL = 'financial',
  CLINICAL = 'clinical',
  OPERATIONAL = 'operational',
}

@Entity('analytics_metrics')
export class AnalyticsMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'metric_name', type: 'varchar', length: 100 })
  metricName: string;

  @Column({
    name: 'metric_category',
    type: 'varchar',
    length: 50,
    nullable: true,
    enum: MetricCategory,
  })
  metricCategory?: MetricCategory;

  @Column({ name: 'metric_date', type: 'date' })
  metricDate: Date;

  @Column({ name: 'metric_value', type: 'decimal', precision: 15, scale: 2, nullable: true })
  metricValue?: number;

  @Column({ name: 'metric_unit', type: 'varchar', length: 50, nullable: true })
  metricUnit?: string;

  @Column({ type: 'jsonb', default: {} })
  dimensions: Record<string, any>;

  @Column({ name: 'calculated_at', type: 'timestamptz', default: () => 'NOW()' })
  calculatedAt: Date;

  @Column({ name: 'calculation_method', type: 'varchar', length: 255, nullable: true })
  calculationMethod?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

