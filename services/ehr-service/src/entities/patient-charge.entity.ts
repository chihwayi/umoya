import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

@Entity('patient_charges')
export class PatientCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'admission_id', nullable: true })
  admissionId: string;

  @Column({ name: 'charge_code', length: 50 })
  chargeCode: string;

  @Column({ name: 'charge_description', type: 'text' })
  chargeDescription: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_charge', type: 'decimal', precision: 10, scale: 2, generatedType: 'STORED', asExpression: 'quantity * unit_price' })
  totalCharge: number;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate: Date;

  @Column({ name: 'source_type', length: 100, nullable: true })
  sourceType: string;

  @Column({ name: 'source_id', nullable: true })
  sourceId: string;

  @Column({ name: 'cpt_code', length: 10, nullable: true })
  cptCode: string;

  @Column({ name: 'icd10_code', length: 10, nullable: true })
  icd10Code: string;

  @Column({ length: 100, nullable: true })
  department: string;

  @Column({ name: 'ordering_provider', nullable: true })
  orderingProviderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordering_provider' })
  orderingProvider: User;

  @Column({ name: 'charge_status', length: 50, default: 'pending' })
  chargeStatus: string;

  @Column({ name: 'capture_method', length: 50, nullable: true })
  captureMethod: string;

  @Column({ name: 'captured_by', nullable: true })
  capturedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'captured_by' })
  capturedBy: User;

  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'NOW()' })
  capturedAt: Date;

  // Approval Workflow Columns (from Migration 028)
  @Column({ name: 'reviewed_by', nullable: true })
  reviewedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'approved_by', nullable: true })
  approvedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'approval_notes', type: 'text', nullable: true })
  approvalNotes: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}



