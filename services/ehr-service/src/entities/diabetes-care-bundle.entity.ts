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

@Entity('diabetes_care_bundle')
export class DiabetesCareBundle {
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

  @Column({ name: 'bundle_date', type: 'date' })
  bundleDate: Date;

  @Column({ name: 'hba1c_checked', type: 'boolean', default: false })
  hba1cChecked: boolean;

  @Column({ name: 'hba1c_value', type: 'numeric', precision: 5, scale: 2, nullable: true })
  hba1cValue?: number;

  @Column({ name: 'hba1c_date', type: 'date', nullable: true })
  hba1cDate?: Date;

  @Column({ name: 'blood_pressure_checked', type: 'boolean', default: false })
  bloodPressureChecked: boolean;

  @Column({ name: 'systolic_bp', type: 'int', nullable: true })
  systolicBp?: number;

  @Column({ name: 'diastolic_bp', type: 'int', nullable: true })
  diastolicBp?: number;

  @Column({ name: 'bp_date', type: 'date', nullable: true })
  bloodPressureDate?: Date;

  @Column({ name: 'lipid_profile_checked', type: 'boolean', default: false })
  lipidProfileChecked: boolean;

  @Column({ name: 'lipid_profile_date', type: 'date', nullable: true })
  lipidProfileDate?: Date;

  @Column({ name: 'foot_exam_checked', type: 'boolean', default: false })
  footExamChecked: boolean;

  @Column({ name: 'foot_exam_date', type: 'date', nullable: true })
  footExamDate?: Date;

  @Column({ name: 'foot_exam_result', type: 'text', nullable: true })
  footExamResult?: string;

  @Column({ name: 'eye_exam_checked', type: 'boolean', default: false })
  eyeExamChecked: boolean;

  @Column({ name: 'eye_exam_date', type: 'date', nullable: true })
  eyeExamDate?: Date;

  @Column({ name: 'eye_exam_result', type: 'text', nullable: true })
  eyeExamResult?: string;

  @Column({ name: 'urine_acr_checked', type: 'boolean', default: false })
  urineAcrChecked: boolean;

  @Column({ name: 'urine_acr_value', type: 'numeric', precision: 10, scale: 2, nullable: true })
  urineAcrValue?: number;

  @Column({ name: 'urine_acr_date', type: 'date', nullable: true })
  urineAcrDate?: Date;

  @Column({ name: 'diabetes_education_documented', type: 'boolean', default: false })
  educationDocumented: boolean;

  @Column({ name: 'education_date', type: 'date', nullable: true })
  educationDate?: Date;

  @Column({ name: 'medication_review_completed', type: 'boolean', default: false })
  medicationReviewCompleted: boolean;

  @Column({ name: 'medication_review_date', type: 'date', nullable: true })
  medicationReviewDate?: Date;

  @Column({
    name: 'bundle_completion_percentage',
    type: 'int',
    nullable: true,
  })
  bundleCompletionPercentage?: number;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}




