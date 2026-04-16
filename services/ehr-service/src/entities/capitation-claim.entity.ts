import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('capitation_claims')
export class CapitationClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'nhif_member_id', type: 'uuid' })
  nhifMemberId: string;

  @Column({ name: 'scheme_code', type: 'text' })
  schemeCode: string;

  @Column({ name: 'claim_period_month', type: 'integer' })
  claimPeriodMonth: number;

  @Column({ name: 'claim_period_year', type: 'integer' })
  claimPeriodYear: number;

  @Column({ name: 'visit_date', type: 'date', nullable: true })
  visitDate: string | null;

  @Column({ name: 'service_codes', type: 'text', array: true, default: [] })
  serviceCodes: string[];

  @Column({ name: 'diagnosis_codes', type: 'text', array: true, default: [] })
  diagnosisCodes: string[];

  @Column({ name: 'capitation_amount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  capitationAmount: number | null;

  @Column({ name: 'co_pay_amount', type: 'numeric', precision: 10, scale: 2, default: 0 })
  coPayAmount: number;

  @Column({ name: 'claim_status', type: 'text', default: 'draft' })
  claimStatus: string;

  @Column({ name: 'scheme_reference', type: 'text', nullable: true })
  schemeReference: string | null;

  @Column({ name: 'submission_date', type: 'date', nullable: true })
  submissionDate: string | null;

  @Column({ name: 'approval_date', type: 'date', nullable: true })
  approvalDate: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
