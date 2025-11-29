import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DiabetesRegistry } from './diabetes-registry.entity';
import { Patient } from './patient.entity';

export type DiabetesAlertType =
  | 'overdue_screening'
  | 'abnormal_value'
  | 'medication_adherence'
  | 'hypoglycemia'
  | 'hyperglycemia'
  | 'care_bundle_incomplete'
  | 'device_issue'
  | 'other';
export type DiabetesAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('diabetes_alerts')
export class DiabetesAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'diabetes_registry_id', type: 'uuid' })
  diabetesRegistryId: string;

  @ManyToOne(() => DiabetesRegistry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diabetes_registry_id' })
  registry: DiabetesRegistry;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'alert_type', type: 'varchar', length: 50 })
  alertType: DiabetesAlertType;

  @Column({ name: 'alert_severity', type: 'varchar', length: 20 })
  alertSeverity: DiabetesAlertSeverity;

  @Column({ name: 'alert_message', type: 'text' })
  alertMessage: string;

  @Column({ name: 'related_metric', type: 'varchar', length: 100, nullable: true })
  relatedMetric?: string;

  @Column({ name: 'related_value', type: 'numeric', precision: 12, scale: 4, nullable: true })
  relatedValue?: number;

  @Column({ name: 'related_date', type: 'date', nullable: true })
  relatedDate?: Date;

  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy?: string;

  @Column({ name: 'acknowledged_at', type: 'timestamp with time zone', nullable: true })
  acknowledgedAt?: Date;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string;

  @Column({ name: 'resolved_at', type: 'timestamp with time zone', nullable: true })
  resolvedAt?: Date;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




