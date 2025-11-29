import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { Bill } from './billing.entity';

export enum ClaimStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAID = 'paid'
}

export enum MedicalAidProvider {
  CIMAS = 'cimas',
  PREMIER = 'premier',
  ECONET_HEALTH = 'econet_health',
  FIRST_MUTUAL = 'first_mutual',
  PSMAS = 'psmas'
}

@Entity('medical_aid_claims')
export class MedicalAidClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_number', unique: true })
  claimNumber: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Bill)
  @JoinColumn({ name: 'billing_id' })
  bill: Bill;

  @Column({ name: 'billing_id' })
  billId: string;

  @Column({ name: 'medical_aid_name' })
  medicalAidProvider: string;

  @Column({ name: 'member_number' })
  memberNumber: string;

  @Column({ name: 'claim_amount', type: 'decimal', precision: 10, scale: 2 })
  claimAmount: number;

  @Column({ name: 'approved_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  approvedAmount: number;

  @Column({ type: 'varchar', default: ClaimStatus.DRAFT })
  status: ClaimStatus;

  @Column({ name: 'submission_date', type: 'timestamp', nullable: true })
  submissionDate: Date;

  @Column({ name: 'response_date', type: 'timestamp', nullable: true })
  responseDate: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'claim_data', type: 'jsonb', nullable: true })
  claimData?: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}