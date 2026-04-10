import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('nhif_claims')
export class NhifClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'scheme_member_id', type: 'uuid', nullable: true })
  schemeMemberId: string | null;

  @Column({ name: 'nhif_scheme_id', type: 'uuid', nullable: true })
  nhifSchemeId: string | null;

  @Column({ name: 'claim_number', length: 50, nullable: true })
  claimNumber: string | null;

  @Column({ name: 'claim_date', type: 'date' })
  claimDate: string;

  @Column({ name: 'visit_type', length: 30, nullable: true })
  visitType: string | null;

  @Column({ name: 'diagnosis_icd10', length: 10, nullable: true })
  diagnosisIcd10: string | null;

  @Column({ name: 'procedure_codes', type: 'text', array: true, nullable: true })
  procedureCodes: string[] | null;

  @Column({ name: 'claimed_amount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  claimedAmount: number | null;

  @Column({ name: 'approved_amount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  approvedAmount: number | null;

  @Column({ name: 'copay_amount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  copayAmount: number | null;

  @Column({ name: 'status', length: 20, default: 'submitted' })
  status: string;

  @Column({ name: 'scheme_reference', length: 50, nullable: true })
  schemeReference: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
