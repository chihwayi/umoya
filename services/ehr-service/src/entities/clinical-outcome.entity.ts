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
import { AppointmentSimple } from './appointment-simple.entity';
import { Prescription } from './prescription.entity';
import { LabOrder } from './lab-order.entity';

export enum OutcomeType {
  TREATMENT_RESPONSE = 'treatment_response',
  READMISSION = 'readmission',
  COMPLICATION = 'complication',
  MORTALITY = 'mortality',
  QUALITY_OF_LIFE = 'quality_of_life',
  OTHER = 'other',
}

export enum OutcomeStatus {
  IMPROVED = 'improved',
  STABLE = 'stable',
  WORSENED = 'worsened',
  RESOLVED = 'resolved',
  ONGOING = 'ongoing',
}

export enum Severity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

@Entity('clinical_outcomes')
export class ClinicalOutcome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({
    name: 'outcome_type',
    type: 'varchar',
    length: 50,
    enum: OutcomeType,
  })
  outcomeType: OutcomeType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  condition?: string;

  @Column({ name: 'snomed_code', type: 'varchar', length: 50, nullable: true })
  snomedCode?: string;

  @Column({ name: 'baseline_date', type: 'date', nullable: true })
  baselineDate?: Date;

  @Column({ name: 'outcome_date', type: 'date', nullable: true })
  outcomeDate?: Date;

  @Column({ name: 'outcome_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  outcomeValue?: number;

  @Column({ name: 'outcome_unit', type: 'varchar', length: 50, nullable: true })
  outcomeUnit?: string;

  @Column({
    name: 'outcome_status',
    type: 'varchar',
    length: 50,
    nullable: true,
    enum: OutcomeStatus,
  })
  outcomeStatus?: OutcomeStatus;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    enum: Severity,
  })
  severity?: Severity;

  @Column({ name: 'related_appointment_id', type: 'uuid', nullable: true })
  relatedAppointmentId?: string;

  @ManyToOne(() => AppointmentSimple, { nullable: true })
  @JoinColumn({ name: 'related_appointment_id' })
  relatedAppointment?: AppointmentSimple;

  @Column({ name: 'related_prescription_id', type: 'uuid', nullable: true })
  relatedPrescriptionId?: string;

  @ManyToOne(() => Prescription, { nullable: true })
  @JoinColumn({ name: 'related_prescription_id' })
  relatedPrescription?: Prescription;

  @Column({ name: 'related_lab_order_id', type: 'uuid', nullable: true })
  relatedLabOrderId?: string;

  @ManyToOne(() => LabOrder, { nullable: true })
  @JoinColumn({ name: 'related_lab_order_id' })
  relatedLabOrder?: LabOrder;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by' })
  recordedBy?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

