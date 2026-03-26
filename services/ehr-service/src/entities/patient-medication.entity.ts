import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export enum MedicationType {
  CURRENT = 'current',
  PAST = 'past',
  ALLERGY = 'allergy',
  DISCONTINUED = 'discontinued',
}

export enum MedicationStatus {
  ACTIVE = 'active',
  DISCONTINUED = 'discontinued',
  COMPLETED = 'completed',
  ALLERGY = 'allergy',
  ON_HOLD = 'on_hold',
}

export enum ReconciliationStatus {
  VERIFIED = 'verified',
  NEEDS_REVIEW = 'needs_review',
  DISCREPANCY = 'discrepancy',
  RESOLVED = 'resolved',
}

export enum ReconciliationType {
  ADMISSION = 'admission',
  TRANSFER = 'transfer',
  DISCHARGE = 'discharge',
  OUTPATIENT_VISIT = 'outpatient_visit',
  PHARMACY_VISIT = 'pharmacy_visit',
}

@Entity('patient_medications')
export class PatientMedication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'patient_id' })
  @Index('idx_patient_medications_patient_id')
  patientId: string;

  @Column({ name: 'medication_name', length: 255 })
  medicationName: string;

  @Column({ name: 'generic_name', length: 255, nullable: true })
  genericName?: string;

  @Column({ name: 'snomed_concept_id', length: 50, nullable: true })
  @Index('idx_patient_medications_snomed_concept_id')
  snomedConceptId?: string;

  @Column({ name: 'snomed_term', type: 'text', nullable: true })
  snomedTerm?: string;

  @Column({
    name: 'medication_type',
    type: 'enum',
    enum: MedicationType,
    default: MedicationType.CURRENT,
  })
  @Index('idx_patient_medications_medication_type')
  medicationType: MedicationType;

  @Column({ length: 100 })
  dosage: string;

  @Column({ name: 'dosage_unit', length: 50, nullable: true })
  dosageUnit?: string;

  @Column({ length: 100 })
  frequency: string;

  @Column({ length: 50, nullable: true })
  route?: string;

  @Column({ length: 100, nullable: true })
  duration?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  @Index('idx_patient_medications_start_date')
  startDate?: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  @Index('idx_patient_medications_end_date')
  endDate?: Date;

  @Column('uuid', { name: 'prescribed_by', nullable: true })
  prescribedBy?: string;

  @Column({ name: 'prescribing_physician_name', length: 255, nullable: true })
  prescribingPhysicianName?: string;

  @Column('uuid', { name: 'prescription_id', nullable: true })
  @Index('idx_patient_medications_prescription_id')
  prescriptionId?: string;

  @Column({
    type: 'enum',
    enum: MedicationStatus,
    default: MedicationStatus.ACTIVE,
  })
  @Index('idx_patient_medications_status')
  status: MedicationStatus;

  @Column({ name: 'reason_for_discontinuation', type: 'text', nullable: true })
  reasonForDiscontinuation?: string;

  @Column({ name: 'adherence_percentage', type: 'int', nullable: true })
  adherencePercentage?: number;

  @Column({ name: 'last_taken_date', type: 'date', nullable: true })
  lastTakenDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    name: 'reconciliation_status',
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.VERIFIED,
  })
  @Index('idx_patient_medications_reconciliation_status')
  reconciliationStatus: ReconciliationStatus;

  @Column({ name: 'reconciliation_notes', type: 'text', nullable: true })
  reconciliationNotes?: string;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdById?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('medication_adherence')
@Unique('medication_adherence_medication_id_adherence_date_key', ['medicationId', 'adherenceDate'])
export class MedicationAdherence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'medication_id' })
  @Index('idx_medication_adherence_medication_id')
  medicationId: string;

  @Column('uuid', { name: 'patient_id' })
  @Index('idx_medication_adherence_patient_id')
  patientId: string;

  @Column({ name: 'adherence_date', type: 'date' })
  @Index('idx_medication_adherence_adherence_date')
  adherenceDate: Date;

  @Column({ type: 'boolean', default: false })
  taken: boolean;

  @Column({ name: 'missed_reason', length: 255, nullable: true })
  missedReason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column('uuid', { name: 'recorded_by', nullable: true })
  recordedById?: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', nullable: true, default: () => 'NOW()' })
  recordedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('medication_reconciliation_log')
export class MedicationReconciliationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'patient_id' })
  @Index('idx_medication_reconciliation_log_patient_id')
  patientId: string;

  @Column({ name: 'reconciliation_date', type: 'timestamp with time zone', default: () => 'NOW()' })
  @Index('idx_medication_reconciliation_log_reconciliation_date')
  reconciliationDate: Date;

  @Column('uuid', { name: 'reconciled_by', nullable: true })
  reconciledById?: string;

  @Column({
    name: 'reconciliation_type',
    type: 'enum',
    enum: ReconciliationType,
  })
  @Index('idx_medication_reconciliation_log_reconciliation_type')
  reconciliationType: ReconciliationType;

  @Column({ length: 100, nullable: true })
  source?: string;

  @Column({ name: 'discrepancies_found', type: 'int', default: 0 })
  discrepanciesFound: number;

  @Column({ name: 'discrepancies_resolved', type: 'int', default: 0 })
  discrepanciesResolved: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
