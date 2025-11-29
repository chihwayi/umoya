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

export type InsulinRegimenType = 'basal_only' | 'basal_bolus' | 'premixed' | 'pump' | 'other';
export type InsulinRegimenStatus = 'active' | 'discontinued' | 'on_hold';

@Entity('insulin_regimens')
export class InsulinRegimen {
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

  @Column({ name: 'regimen_type', type: 'varchar', length: 30 })
  regimenType: InsulinRegimenType;

  @Column({ name: 'basal_insulin_type', type: 'varchar', length: 100, nullable: true })
  basalInsulinType?: string;

  @Column({ name: 'basal_dose', type: 'numeric', precision: 8, scale: 2, nullable: true })
  basalDose?: number;

  @Column({ name: 'basal_frequency', type: 'varchar', length: 100, nullable: true })
  basalFrequency?: string;

  @Column({ name: 'bolus_insulin_type', type: 'varchar', length: 100, nullable: true })
  bolusInsulinType?: string;

  @Column({ name: 'bolus_ratio', type: 'numeric', precision: 6, scale: 2, nullable: true })
  bolusRatio?: number;

  @Column({ name: 'correction_factor', type: 'numeric', precision: 6, scale: 2, nullable: true })
  correctionFactor?: number;

  @Column({ name: 'target_glucose', type: 'numeric', precision: 6, scale: 2, nullable: true })
  targetGlucose?: number;

  @Column({ name: 'carb_ratio', type: 'numeric', precision: 6, scale: 2, nullable: true })
  carbRatio?: number;

  @Column({ name: 'pump_settings', type: 'jsonb', nullable: true })
  pumpSettings?: Record<string, any>;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: InsulinRegimenStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




