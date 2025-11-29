import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export type MonitoringType = 'blood_pressure' | 'blood_glucose' | 'weight' | 'temperature' | 'heart_rate' | 'oxygen_saturation' | 'other';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('remote_patient_monitoring')
export class RemotePatientMonitoring {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'monitoring_type', type: 'varchar', length: 30 })
  monitoringType: MonitoringType;

  @Column({ name: 'device_name', type: 'varchar', length: 255, nullable: true })
  deviceName?: string;

  @Column({ name: 'device_model', type: 'varchar', length: 255, nullable: true })
  deviceModel?: string;

  @Column({ name: 'reading_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  readingValue?: number;

  @Column({ name: 'reading_unit', type: 'varchar', length: 20, nullable: true })
  readingUnit?: string;

  @Column({ name: 'reading_date', type: 'timestamptz', default: () => 'NOW()' })
  readingDate: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy?: User;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedById?: string;

  @Column({ name: 'device_synced', type: 'boolean', default: false })
  deviceSynced: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'alert_triggered', type: 'boolean', default: false })
  alertTriggered: boolean;

  @Column({ name: 'alert_severity', type: 'varchar', length: 20, nullable: true })
  alertSeverity?: AlertSeverity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

