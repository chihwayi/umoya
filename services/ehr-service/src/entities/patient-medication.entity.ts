import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
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

  @Column('uuid')
  @Index('idx_patient_medications_patient_id')
  patientId: string;

  @Column({ length: 255 })
  medicationName: string;

  @Column({ length: 255, nullable: true })
  genericName?: string;

  @Column({ length: 50, nullable: true })
  snomedConceptId?: string;

  @Column({ type: 'text', nullable: true })
  snomedTerm?: string;

  @Column({
    type: 'enum',
    enum: MedicationType,
    default: MedicationType.CURRENT,
  })
  @Index('idx_patient_medications_medication_type')
  medicationType: MedicationType;

  @Column({ length: 100 })
  dosage: string;

  @Column({ length: 50, nullable: true })
  dosageUnit?: string;

  @Column({ length: 100 })
  frequency: string;

  @Column({ length: 50, nullable: true })
  route?: string;

  @Column({ length: 100, nullable: true })
  duration?: string;

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column('uuid', { nullable: true })
  prescribedBy?: string;

  @Column({ length: 255, nullable: true })
  prescribingPhysicianName?: string;

  @Column('uuid', { nullable: true })
  prescriptionId?: string;

  @Column({
    type: 'enum',
    enum: MedicationStatus,
    default: MedicationStatus.ACTIVE,
  })
  @Index('idx_patient_medications_status')
  status: MedicationStatus;

  @Column({ type: 'text', nullable: true })
  reasonForDiscontinuation?: string;

  @Column({ type: 'int', nullable: true })
  adherencePercentage?: number;

  @Column({ type: 'date', nullable: true })
  lastTakenDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.VERIFIED,
  })
  @Index('idx_patient_medications_reconciliation_status')
  reconciliationStatus: ReconciliationStatus;

  @Column({ type: 'text', nullable: true })
  reconciliationNotes?: string;

  @Column('uuid', { nullable: true })
  createdById?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('medication_adherence')
export class MedicationAdherence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index('idx_medication_adherence_medication_id')
  medicationId: string;

  @Column('uuid')
  @Index('idx_medication_adherence_patient_id')
  patientId: string;

  @Column({ type: 'date' })
  @Index('idx_medication_adherence_adherence_date')
  adherenceDate: Date;

  @Column({ type: 'boolean', default: false })
  taken: boolean;

  @Column({ length: 255, nullable: true })
  missedReason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column('uuid', { nullable: true })
  recordedById?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('medication_reconciliation_log')
export class MedicationReconciliationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index('idx_medication_reconciliation_log_patient_id')
  patientId: string;

  @Column({ type: 'timestamp with time zone', default: () => 'NOW()' })
  @Index('idx_medication_reconciliation_log_reconciliation_date')
  reconciliationDate: Date;

  @Column('uuid', { nullable: true })
  reconciledById?: string;

  @Column({
    type: 'enum',
    enum: ReconciliationType,
  })
  @Index('idx_medication_reconciliation_log_reconciliation_type')
  reconciliationType: ReconciliationType;

  @Column({ length: 100, nullable: true })
  source?: string;

  @Column({ type: 'int', default: 0 })
  discrepanciesFound: number;

  @Column({ type: 'int', default: 0 })
  discrepanciesResolved: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

