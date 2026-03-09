import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('insurance_verifications')
export class InsuranceVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Index()
  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'payer_name', length: 255, nullable: true })
  payerName: string | null;

  @Column({ name: 'policy_number', length: 100, nullable: true })
  policyNumber: string | null;

  @Column({ name: 'group_number', length: 100, nullable: true })
  groupNumber: string | null;

  @Column({ name: 'verification_status', length: 30, default: 'pending' })
  verificationStatus: string;

  @Column({ name: 'coverage_details', type: 'jsonb', default: () => `'{}'::jsonb` })
  coverageDetails: Record<string, any>;

  @Column({ name: 'copay_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  copayAmount: string | null;

  @Column({ name: 'deductible_remaining', type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductibleRemaining: string | null;

  @Column({ name: 'verified_at', type: 'timestamp with time zone', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

