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

@Entity('ed_visits')
export class EDVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ed_visit_number', length: 50, unique: true })
  edVisitNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'arrival_date', type: 'timestamptz' })
  arrivalDate: Date;

  @Column({ name: 'arrival_time', type: 'timestamptz' })
  arrivalTime: Date;

  @Column({ name: 'arrival_mode', length: 50 })
  arrivalMode: string;

  @Column({ name: 'chief_complaint', type: 'text' })
  chiefComplaint: string;

  @Column({ name: 'chief_complaint_snomed', length: 20, nullable: true })
  chiefComplaintSnomed: string;

  @Column({ name: 'chief_complaint_term', type: 'text', nullable: true })
  chiefComplaintTerm: string;

  @Column({ name: 'presenting_symptoms', type: 'text', nullable: true })
  presentingSymptoms: string;

  @Column({ name: 'presenting_symptoms_coded', type: 'jsonb', default: '[]' })
  presentingSymptomsCoded: any[];

  @Column({ name: 'triage_level', nullable: true })
  triageLevel: number;

  @Column({ name: 'triage_acuity', length: 50, nullable: true })
  triageAcuity: string;

  @Column({ name: 'triage_completed_at', type: 'timestamptz', nullable: true })
  triageCompletedAt: Date;

  @Column({ name: 'triage_completed_by', type: 'uuid', nullable: true })
  triageCompletedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'triage_completed_by' })
  triageCompletedByUser: User;

  @Column({ name: 'vital_signs', type: 'jsonb', nullable: true })
  vitalSigns: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ name: 'current_medications', type: 'text', nullable: true })
  currentMedications: string;

  @Column({ name: 'last_meal_time', type: 'timestamptz', nullable: true })
  lastMealTime: Date;

  @Column({ name: 'tetanus_status', length: 50, nullable: true })
  tetanusStatus: string;

  @Column({ name: 'bed_assigned', length: 50, nullable: true })
  bedAssigned: string;

  @Column({ name: 'room_assigned', length: 50, nullable: true })
  roomAssigned: string;

  @Column({ name: 'attending_provider', type: 'uuid', nullable: true })
  attendingProvider: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'attending_provider' })
  attendingProviderUser: User;

  @Column({ name: 'primary_nurse', type: 'uuid', nullable: true })
  primaryNurse: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'primary_nurse' })
  primaryNurseUser: User;

  @Column({ name: 'ed_status', length: 50, default: 'waiting' })
  edStatus: string;

  @Column({ name: 'fast_track', default: false })
  fastTrack: boolean;

  @Column({ name: 'trauma_activation', default: false })
  traumaActivation: boolean;

  @Column({ name: 'trauma_level', length: 20, nullable: true })
  traumaLevel: string;

  @Column({ name: 'code_stroke', default: false })
  codeStroke: boolean;

  @Column({ name: 'code_stemi', default: false })
  codeStemi: boolean;

  @Column({ name: 'code_sepsis', default: false })
  codeSepsis: boolean;

  @Column({ name: 'isolation_required', default: false })
  isolationRequired: boolean;

  @Column({ name: 'isolation_precautions', length: 100, nullable: true })
  isolationPrecautions: string;

  @Column({ name: 'time_to_provider', nullable: true })
  timeToProvider: number;

  @Column({ name: 'time_to_treatment', nullable: true })
  timeToTreatment: number;

  @Column({ name: 'total_ed_time', nullable: true })
  totalEdTime: number;

  @Column({ length: 100, nullable: true })
  disposition: string;

  @Column({ name: 'disposition_time', type: 'timestamptz', nullable: true })
  dispositionTime: Date;

  @Column({ name: 'discharge_diagnosis', type: 'text', nullable: true })
  dischargeDiagnosis: string;

  @Column({ name: 'discharge_diagnosis_icd10', length: 10, nullable: true })
  dischargeDiagnosisIcd10: string;

  @Column({ name: 'discharge_diagnosis_snomed', length: 20, nullable: true })
  dischargeDiagnosisSnomed: string;

  @Column({ name: 'discharge_diagnosis_term', type: 'text', nullable: true })
  dischargeDiagnosisTerm: string;

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', default: '[]' })
  secondaryDiagnoses: any[];

  @Column({ name: 'procedures_performed', type: 'jsonb', default: '[]' })
  proceduresPerformed: any[];

  @Column({ name: 'discharge_instructions', type: 'text', nullable: true })
  dischargeInstructions: string;

  @Column({ name: 'follow_up_instructions', type: 'text', nullable: true })
  followUpInstructions: string;

  @Column({ name: 'left_ama', default: false })
  leftAma: boolean;

  @Column({ name: 'return_precautions', type: 'text', nullable: true })
  returnPrecautions: string;

  @Column({ name: 'prescriptions_given', type: 'text', nullable: true })
  prescriptionsGiven: string;

  @Column({ type: 'text', nullable: true })
  referrals: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'quality_flags', type: 'jsonb', default: '[]' })
  qualityFlags: any[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

