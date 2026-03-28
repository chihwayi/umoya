import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('patient_vital_baselines')
@Index('idx_patient_vital_baselines_patient_metric', ['patientId', 'metricName'], { unique: true })
@Index('idx_patient_vital_baselines_updated_at', ['updatedAt'])
export class PatientVitalBaseline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'metric_name', type: 'varchar', length: 50 })
  metricName: string;

  @Column({ name: 'baseline_value', type: 'decimal', precision: 10, scale: 2 })
  baselineValue: number;

  @Column({ name: 'lower_bound', type: 'decimal', precision: 10, scale: 2, nullable: true })
  lowerBound: number | null;

  @Column({ name: 'upper_bound', type: 'decimal', precision: 10, scale: 2, nullable: true })
  upperBound: number | null;

  @Column({ name: 'sample_count', type: 'int', default: 0 })
  sampleCount: number;

  @Column({ name: 'baseline_window_days', type: 'int', default: 14 })
  baselineWindowDays: number;

  @Column({ name: 'source', type: 'varchar', length: 30, default: 'rolling_recent' })
  source: string;

  @Column({ name: 'last_vitals_id', type: 'uuid', nullable: true })
  lastVitalsId: string | null;

  @Column({ name: 'last_recorded_at', type: 'timestamptz', nullable: true })
  lastRecordedAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
