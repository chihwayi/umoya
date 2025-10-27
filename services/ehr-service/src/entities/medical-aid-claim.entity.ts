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

  @Column({ unique: true })
  claimNumber: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column()
  patientId: string;

  @ManyToOne(() => Bill)
  @JoinColumn({ name: 'billId' })
  bill: Bill;

  @Column()
  billId: string;

  @Column({ type: 'enum', enum: MedicalAidProvider })
  medicalAidProvider: MedicalAidProvider;

  @Column()
  memberNumber: string;

  @Column()
  memberName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  claimAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  approvedAmount: number;

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.DRAFT })
  status: ClaimStatus;

  @Column({ type: 'timestamp', nullable: true })
  submissionDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  responseDate: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'jsonb', nullable: true })
  claimData: any;

  @Column({ type: 'jsonb', nullable: true })
  responseData: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}