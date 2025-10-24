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

  @Column()
  orderNumber: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column()
  orderingProviderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'orderingProviderId' })
  orderingProvider: User;

  @Column({ nullable: true })
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord)
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'json' })
  tests: Array<{
    testCode: string;
    testName: string;
    category: LabTestCategory;
    specimenType: string;
    instructions?: string;
  }>;

  @Column({ type: 'enum', enum: Priority, default: Priority.ROUTINE })
  priority: Priority;

  @Column({ type: 'enum', enum: LabOrderStatus, default: LabOrderStatus.ORDERED })
  status: LabOrderStatus;

  @Column({ type: 'text', nullable: true })
  clinicalInfo: string;

  @Column({ type: 'text', nullable: true })
  specialInstructions: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledDateTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  collectedAt: Date;

  @Column({ nullable: true })
  collectedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'collectedById' })
  collectedBy: User;

  @Column({ type: 'json', nullable: true })
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

  @Column({ type: 'text', nullable: true })
  interpretation: string;

  @Column({ nullable: true })
  reviewedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'json', nullable: true })
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
    uploadedAt: Date;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}