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
import { Bed } from './bed.entity';

@Entity('admissions')
export class Admission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admission_number', length: 50, unique: true })
  admissionNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'admission_date', type: 'timestamptz' })
  admissionDate: Date;

  @Column({ name: 'admission_time', type: 'timestamptz' })
  admissionTime: Date;

  @Column({ name: 'admission_type', length: 50 })
  admissionType: string;

  @Column({ name: 'admission_source', length: 100, nullable: true })
  admissionSource: string;

  @Column({ name: 'referring_facility', length: 255, nullable: true })
  referringFacility: string;

  @Column({ name: 'admitting_provider', type: 'uuid', nullable: true })
  admittingProvider: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'admitting_provider' })
  admittingProviderUser: User;

  @Column({ name: 'admitting_diagnosis', type: 'text' })
  admittingDiagnosis: string;

  @Column({ name: 'admitting_diagnosis_icd10', length: 10, nullable: true })
  admittingDiagnosisIcd10: string;

  @Column({ name: 'admitting_diagnosis_snomed', length: 20, nullable: true })
  admittingDiagnosisSnomed: string;

  @Column({ name: 'admitting_diagnosis_term', type: 'text', nullable: true })
  admittingDiagnosisTerm: string;

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', default: '[]' })
  secondaryDiagnoses: any[];

  @Column({ name: 'comorbidities_coded', type: 'jsonb', default: '[]' })
  comorbiditiesCoded: any[];

  @Column({ name: 'admission_reason', type: 'text', nullable: true })
  admissionReason: string;

  @Column({ name: 'initial_bed_id', type: 'uuid', nullable: true })
  initialBedId: string;

  @ManyToOne(() => Bed, { nullable: true })
  @JoinColumn({ name: 'initial_bed_id' })
  initialBed: Bed;

  @Column({ name: 'initial_ward', length: 100, nullable: true })
  initialWard: string;

  @Column({ name: 'current_bed_id', type: 'uuid', nullable: true })
  currentBedId: string;

  @ManyToOne(() => Bed, { nullable: true })
  @JoinColumn({ name: 'current_bed_id' })
  currentBed: Bed;

  @Column({ name: 'current_ward', length: 100, nullable: true })
  currentWard: string;

  @Column({ length: 100, nullable: true })
  service: string;

  @Column({ name: 'attending_provider', type: 'uuid', nullable: true })
  attendingProvider: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'attending_provider' })
  attendingProviderUser: User;

  @Column({ name: 'admission_status', length: 50, default: 'active' })
  admissionStatus: string;

  @Column({ name: 'expected_los_days', nullable: true })
  expectedLosDays: number;

  @Column({ name: 'isolation_required', default: false })
  isolationRequired: boolean;

  @Column({ name: 'isolation_type', length: 100, nullable: true })
  isolationType: string;

  @Column({ name: 'code_status', length: 50, nullable: true })
  codeStatus: string;

  @Column({ name: 'advance_directives', type: 'text', nullable: true })
  advanceDirectives: string;

  @Column({ name: 'discharge_plan', type: 'text', nullable: true })
  dischargePlan: string;

  @Column({ name: 'estimated_discharge_date', type: 'date', nullable: true })
  estimatedDischargeDate: Date;

  @Column({ name: 'financial_class', length: 100, nullable: true })
  financialClass: string;

  @Column({ name: 'insurance_verified', default: false })
  insuranceVerified: boolean;

  @Column({ name: 'insurance_authorization', length: 100, nullable: true })
  insuranceAuthorization: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

