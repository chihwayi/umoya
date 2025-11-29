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

@Entity('cgm_summary')
export class CgmSummary {
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

  @Column({ name: 'summary_date', type: 'date' })
  summaryDate: Date;

  @Column({ name: 'time_in_range_70_180', type: 'numeric', precision: 5, scale: 2, nullable: true })
  timeInRange?: number;

  @Column({ name: 'time_above_range_180', type: 'numeric', precision: 5, scale: 2, nullable: true })
  timeAboveRange?: number;

  @Column({ name: 'time_below_range_70', type: 'numeric', precision: 5, scale: 2, nullable: true })
  timeBelowRange?: number;

  @Column({ name: 'time_below_range_54', type: 'numeric', precision: 5, scale: 2, nullable: true })
  timeSevereHypo?: number;

  @Column({ name: 'average_glucose', type: 'numeric', precision: 6, scale: 2, nullable: true })
  averageGlucose?: number;

  @Column({ name: 'glucose_variability', type: 'numeric', precision: 6, scale: 2, nullable: true })
  glucoseVariability?: number;

  @Column({ name: 'total_readings', type: 'int', nullable: true })
  totalReadings?: number;

  @Column({ name: 'device_type', type: 'varchar', length: 100, nullable: true })
  deviceType?: string;

  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  deviceId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




