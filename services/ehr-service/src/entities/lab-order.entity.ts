import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';
import { MedicalRecord } from './medical-record.entity';

export enum LabOrderStatus {
  ORDERED = 'ordered',
  COLLECTED = 'collected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum LabTestCategory {
  HEMATOLOGY = 'hematology',
  CHEMISTRY = 'chemistry',
  MICROBIOLOGY = 'microbiology',
  IMMUNOLOGY = 'immunology',
  PATHOLOGY = 'pathology',
  RADIOLOGY = 'radiology',
  CARDIOLOGY = 'cardiology'
}

export enum Priority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat'
}

@Entity('lab_orders')
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number' })
  orderNumber: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'ordering_provider_id' })
  orderingProviderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordering_provider_id' })
  orderingProvider: User;

  @Column({ name: 'medical_record_id', nullable: true })
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord)
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'jsonb', name: 'tests' })
  tests: Array<{
    testCode: string;
    testName: string;
    category: LabTestCategory;
    specimenType: string;
    instructions?: string;
  }>;

  @Column({ type: 'varchar', name: 'priority', default: Priority.ROUTINE })
  priority: Priority;

  @Column({ type: 'varchar', name: 'status', default: LabOrderStatus.ORDERED })
  status: LabOrderStatus;

  @Column({ type: 'text', name: 'clinical_info', nullable: true })
  clinicalInfo: string;

  @Column({ type: 'text', name: 'special_instructions', nullable: true })
  specialInstructions: string;

  @Column({ type: 'timestamp', name: 'scheduled_date_time', nullable: true })
  scheduledDateTime: Date;

  @Column({ type: 'timestamp', name: 'collected_at', nullable: true })
  collectedAt: Date;

  @Column({ name: 'collected_by_id', nullable: true })
  collectedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'collected_by_id' })
  collectedBy: User;

  @Column({ type: 'jsonb', name: 'results', nullable: true })
  results: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit: string;
    referenceRange: string;
    flag: 'normal' | 'high' | 'low' | 'critical';
    resultDate: Date;
    performedBy: string;
  }>;

  @Column({ type: 'text', name: 'interpretation', nullable: true })
  interpretation: string;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'jsonb', name: 'attachments', nullable: true })
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    uploadedAt: Date;
  }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}