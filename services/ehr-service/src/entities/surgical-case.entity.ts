import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { OperatingRoom } from './operating-room.entity';
import { Admission } from './admission.entity';
import { PatientConsent } from './patient-consent.entity';

@Entity('surgical_cases')
export class SurgicalCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_number', length: 50, unique: true })
  caseNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @Column({ name: 'admission_id', type: 'uuid', nullable: true })
  admissionId: string;

  @ManyToOne(() => Admission, { nullable: true })
  @JoinColumn({ name: 'admission_id' })
  admission: Admission;

  @Column({ name: 'operating_room_id', type: 'uuid', nullable: true })
  operatingRoomId: string;

  @ManyToOne(() => OperatingRoom)
  @JoinColumn({ name: 'operating_room_id' })
  operatingRoom: OperatingRoom;

  // Scheduling
  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: Date;

  @Column({ name: 'scheduled_start_time', type: 'time' })
  scheduledStartTime: string;

  @Column({ name: 'scheduled_end_time', type: 'time' })
  scheduledEndTime: string;

  @Column({ name: 'actual_start_time', type: 'timestamptz', nullable: true })
  actualStartTime: Date;

  @Column({ name: 'actual_end_time', type: 'timestamptz', nullable: true })
  actualEndTime: Date;

  @Column({ name: 'patient_in_room_time', type: 'timestamptz', nullable: true })
  patientInRoomTime: Date;

  @Column({ name: 'patient_out_room_time', type: 'timestamptz', nullable: true })
  patientOutRoomTime: Date;

  // Procedure
  @Column({ name: 'procedure_name', type: 'text' })
  procedureName: string;

  @Column({ name: 'procedure_code_cpt', length: 10, nullable: true })
  procedureCodeCpt: string;

  @Column({ name: 'procedure_code_snomed', length: 20, nullable: true })
  procedureCodeSnomed: string;

  @Column({ name: 'procedure_type', length: 50 })
  procedureType: string;

  @Column({ name: 'surgical_approach', length: 50, nullable: true })
  surgicalApproach: string;

  @Column({ length: 20, nullable: true })
  laterality: string;

  // Diagnosis
  @Column({ name: 'primary_diagnosis', type: 'text' })
  primaryDiagnosis: string;

  @Column({ name: 'primary_diagnosis_icd10', length: 10, nullable: true })
  primaryDiagnosisIcd10: string;

  @Column({ name: 'primary_diagnosis_snomed', length: 20, nullable: true })
  primaryDiagnosisSnomed: string;

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', default: '[]' })
  secondaryDiagnoses: any[];

  // Staff
  @Column({ name: 'primary_surgeon_id', type: 'uuid' })
  primarySurgeonId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'primary_surgeon_id' })
  primarySurgeon: User;

  @Column({ name: 'assistant_surgeon_id', type: 'uuid', nullable: true })
  assistantSurgeonId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assistant_surgeon_id' })
  assistantSurgeon: User;

  @Column({ name: 'anesthesiologist_id', type: 'uuid', nullable: true })
  anesthesiologistId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'anesthesiologist_id' })
  anesthesiologist: User;

  @Column({ name: 'scrub_nurse_id', type: 'uuid', nullable: true })
  scrubNurseId: string;

  @Column({ name: 'circulating_nurse_id', type: 'uuid', nullable: true })
  circulatingNurseId: string;

  @Column({ name: 'additional_staff', type: 'jsonb', default: '[]' })
  additionalStaff: any[];

  // Status
  @Column({ length: 50, default: 'scheduled' })
  status: string;

  @Column({ name: 'case_priority', type: 'integer', default: 3 })
  casePriority: number;

  // Documentation
  @Column({ name: 'pre_op_diagnosis', type: 'text', nullable: true })
  preOpDiagnosis: string;

  @Column({ name: 'post_op_diagnosis', type: 'text', nullable: true })
  postOpDiagnosis: string;

  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ name: 'procedure_performed', type: 'text', nullable: true })
  procedurePerformed: string;

  @Column({ type: 'text', nullable: true })
  complications: string;

  @Column({ name: 'estimated_blood_loss', type: 'integer', nullable: true })
  estimatedBloodLoss: number;

  @Column({ name: 'specimens_sent', type: 'jsonb', default: '[]' })
  specimensSent: any[];

  @Column({ name: 'drains_placed', type: 'jsonb', default: '[]' })
  drainsPlaced: any[];

  @Column({ name: 'implants_used', type: 'jsonb', default: '[]' })
  implantsUsed: any[];

  // Anesthesia
  @Column({ name: 'anesthesia_type', length: 50, nullable: true })
  anesthesiaType: string;

  @Column({ name: 'anesthesia_start_time', type: 'timestamptz', nullable: true })
  anesthesiaStartTime: Date;

  @Column({ name: 'anesthesia_end_time', type: 'timestamptz', nullable: true })
  anesthesiaEndTime: Date;

  @Column({ length: 50, nullable: true })
  disposition: string;

  // Administrative
  @Column({ name: 'consent_id', type: 'uuid', nullable: true })
  consentId: string;

  @ManyToOne(() => PatientConsent, { nullable: true })
  @JoinColumn({ name: 'consent_id' })
  consent: PatientConsent;

  @Column({ name: 'case_cancelled_reason', type: 'text', nullable: true })
  caseCancelledReason: string;

  @Column({ name: 'case_postponed_reason', type: 'text', nullable: true })
  casePostponedReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

