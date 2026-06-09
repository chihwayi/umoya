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

export type GlucoseMonitoringType = 'self_monitoring' | 'cgm' | 'flash' | 'lab';
export type GlucoseReadingType = 'fasting' | 'pre_meal' | 'post_meal' | 'random' | 'bedtime' | 'overnight' | 'other';

@Entity('glucose_monitoring')
export class GlucoseMonitoring {
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

  @Column({ name: 'monitoring_type', type: 'varchar', length: 30 })
  monitoringType: GlucoseMonitoringType;

  @Column({ name: 'device_type', type: 'varchar', length: 100, nullable: true })
  deviceType?: string;

  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  deviceId?: string;

  @Column({ name: 'glucose_value', type: 'numeric', precision: 6, scale: 2 })
  glucoseValue: number;

  @Column({ name: 'glucose_unit', type: 'varchar', length: 10, default: 'mmol/L' })
  glucoseUnit: 'mg/dL' | 'mmol/L';

  @Column({ name: 'reading_type', type: 'varchar', length: 30, nullable: true })
  readingType?: GlucoseReadingType;

  @Column({ name: 'meal_context', type: 'text', nullable: true })
  mealContext?: string;

  @Column({ name: 'insulin_dose', type: 'numeric', precision: 8, scale: 2, nullable: true })
  insulinDose?: number;

  @Column({ name: 'insulin_type', type: 'varchar', length: 100, nullable: true })
  insulinType?: string;

  @Column({ name: 'carbohydrates_grams', type: 'numeric', precision: 6, scale: 2, nullable: true })
  carbohydratesGrams?: number;

  @Column({ name: 'exercise_minutes', type: 'int', nullable: true })
  exerciseMinutes?: number;

  @Column({ name: 'stress_level', type: 'int', nullable: true })
  stressLevel?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    name: 'recorded_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  recordedAt: Date;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy?: string;

  @Column({ name: 'device_synced_at', type: 'timestamp with time zone', nullable: true })
  deviceSyncedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




