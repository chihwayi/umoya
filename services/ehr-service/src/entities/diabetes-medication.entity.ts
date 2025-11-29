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

export type DiabetesMedicationType = 'oral' | 'injectable' | 'insulin' | 'combination' | 'other';
export type DiabetesMedicationCategory =
  | 'metformin'
  | 'sulfonylurea'
  | 'dpp4_inhibitor'
  | 'sglt2_inhibitor'
  | 'glp1_agonist'
  | 'thiazolidinedione'
  | 'alpha_glucosidase_inhibitor'
  | 'meglitinide'
  | 'insulin_basal'
  | 'insulin_bolus'
  | 'insulin_premixed'
  | 'other';
export type DiabetesMedicationStatus = 'active' | 'discontinued' | 'on_hold' | 'completed';
export type DiabetesMedicationRoute = 'oral' | 'subcutaneous' | 'intramuscular' | 'intravenous' | 'inhalation' | 'other';

@Entity('diabetes_medications')
export class DiabetesMedication {
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

  @Column({ name: 'medication_name', type: 'varchar', length: 255 })
  medicationName: string;

  @Column({ name: 'medication_type', type: 'varchar', length: 30 })
  medicationType: DiabetesMedicationType;

  @Column({ name: 'medication_category', type: 'varchar', length: 100, nullable: true })
  medicationCategory?: DiabetesMedicationCategory;

  @Column({ name: 'medication_snomed_code', type: 'varchar', length: 50, nullable: true })
  medicationSnomedCode?: string;

  @Column({ name: 'medication_snomed_term', type: 'text', nullable: true })
  medicationSnomedTerm?: string;

  @Column({ type: 'varchar', length: 100 })
  dosage: string;

  @Column({ type: 'varchar', length: 100 })
  frequency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  route?: DiabetesMedicationRoute;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: DiabetesMedicationStatus;

  @Column({ name: 'adherence_percentage', type: 'int', nullable: true })
  adherencePercentage?: number;

  @Column({ name: 'prescribed_by', type: 'uuid', nullable: true })
  prescribedBy?: string;

  @Column({ name: 'reason_for_discontinuation', type: 'text', nullable: true })
  reasonForDiscontinuation?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




