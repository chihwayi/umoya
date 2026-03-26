import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('remote_monitoring_events')
@Index('idx_remote_monitoring_events_patient', ['patientId'])
@Index('idx_remote_monitoring_events_device', ['deviceId'])
@Index('idx_remote_monitoring_events_source_type', ['sourceType'])
@Index('idx_remote_monitoring_events_verification_status', ['verificationStatus'])
@Index('idx_remote_monitoring_events_submitted_at', ['submittedAt'])
export class RemoteMonitoringEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'submitted_by_patient_id', type: 'uuid', nullable: true })
  submittedByPatientId: string | null;

  @Column({ name: 'vitals_id', type: 'uuid', nullable: true })
  vitalsId: string | null;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null;

  @Column({ name: 'device_type', type: 'varchar', length: 50, nullable: true })
  deviceType: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 30, default: 'self_report' })
  sourceType: string;

  @Column({ name: 'source_name', type: 'varchar', length: 100, nullable: true })
  sourceName: string | null;

  @Column({ name: 'source_vendor', type: 'varchar', length: 100, nullable: true })
  sourceVendor: string | null;

  @Column({ name: 'source_model', type: 'varchar', length: 120, nullable: true })
  sourceModel: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 50, default: 'vitals_submission' })
  eventType: string;

  @Column({ name: 'verification_status', type: 'varchar', length: 30, default: 'self_reported' })
  verificationStatus: string;

  @Column({ name: 'source_confidence', type: 'decimal', precision: 5, scale: 2, nullable: true })
  sourceConfidence: number | null;

  @Column({ name: 'measurement_count', type: 'int', default: 0 })
  measurementCount: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, any>;

  @Column({ name: 'evaluation_summary', type: 'text', nullable: true })
  evaluationSummary: string | null;

  @Column({ name: 'alert_count', type: 'int', default: 0 })
  alertCount: number;

  @Column({ name: 'submitted_at', type: 'timestamptz', default: () => 'NOW()' })
  submittedAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
