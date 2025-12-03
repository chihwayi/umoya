import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { Admission } from './admission.entity';

@Entity('discharges')
export class Discharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admission_id', type: 'uuid' })
  admissionId: string;

  @ManyToOne(() => Admission)
  @JoinColumn({ name: 'admission_id' })
  admission: Admission;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'discharge_date', type: 'timestamptz' })
  dischargeDate: Date;

  @Column({ name: 'discharge_time', type: 'timestamptz' })
  dischargeTime: Date;

  @Column({ name: 'discharge_type', length: 50 })
  dischargeType: string;

  @Column({ name: 'discharge_disposition', length: 100 })
  dischargeDisposition: string;

  @Column({ name: 'discharge_destination', length: 255, nullable: true })
  dischargeDestination: string;

  @Column({ name: 'discharge_diagnosis', type: 'text' })
  dischargeDiagnosis: string;

  @Column({ name: 'discharge_diagnosis_icd10', length: 10, nullable: true })
  dischargeDiagnosisIcd10: string;

  @Column({ name: 'discharge_diagnosis_snomed', length: 20, nullable: true })
  dischargeDiagnosisSnomed: string;

  @Column({ name: 'discharge_diagnosis_term', type: 'text', nullable: true })
  dischargeDiagnosisTerm: string;

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', default: '[]' })
  secondaryDiagnoses: any[];

  @Column({ name: 'drg_code', length: 10, nullable: true })
  drgCode: string;

  @Column({ name: 'drg_description', type: 'text', nullable: true })
  drgDescription: string;

  @Column({ name: 'drg_weight', type: 'decimal', precision: 5, scale: 2, nullable: true })
  drgWeight: number;

  @Column({ name: 'procedures_performed', type: 'jsonb', default: '[]' })
  proceduresPerformed: any[];

  @Column({ name: 'discharge_condition', length: 100, nullable: true })
  dischargeCondition: string;

  @Column({ name: 'discharge_provider', type: 'uuid', nullable: true })
  dischargeProvider: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'discharge_provider' })
  dischargeProviderUser: User;

  @Column({ name: 'discharge_instructions', type: 'text', nullable: true })
  dischargeInstructions: string;

  @Column({ name: 'medications_prescribed', type: 'text', nullable: true })
  medicationsPrescribed: string;

  @Column({ name: 'follow_up_appointments', type: 'text', nullable: true })
  followUpAppointments: string;

  @Column({ name: 'follow_up_provider', type: 'uuid', nullable: true })
  followUpProvider: string;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: Date;

  @Column({ type: 'text', nullable: true })
  restrictions: string;

  @Column({ name: 'diet_instructions', type: 'text', nullable: true })
  dietInstructions: string;

  @Column({ name: 'activity_level', type: 'text', nullable: true })
  activityLevel: string;

  @Column({ name: 'wound_care', type: 'text', nullable: true })
  woundCare: string;

  @Column({ name: 'home_health_ordered', default: false })
  homeHealthOrdered: boolean;

  @Column({ name: 'dme_ordered', default: false })
  dmeOrdered: boolean;

  @Column({ name: 'dme_details', type: 'text', nullable: true })
  dmeDetails: string;

  @Column({ name: 'transportation_arranged', default: false })
  transportationArranged: boolean;

  @Column({ name: 'patient_education_provided', default: false })
  patientEducationProvided: boolean;

  @Column({ name: 'discharge_summary_completed', default: false })
  dischargeSummaryCompleted: boolean;

  @Column({ name: 'discharge_summary_sent_date', type: 'timestamptz', nullable: true })
  dischargeSummarySentDate: Date;

  @Column({ name: 'length_of_stay_hours', nullable: true })
  lengthOfStayHours: number;

  @Column({ name: 'readmission_risk', length: 50, nullable: true })
  readmissionRisk: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

