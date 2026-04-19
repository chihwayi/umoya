import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'cbhi_claims' })
export class CbhiClaim {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'claim_number', unique: true }) claimNumber: string;

  @Column({ name: 'household_id', type: 'uuid' }) householdId: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;

  @Column({ name: 'scheme_id' }) schemeId: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true }) encounterId: string | null;

  @Column({ name: 'admission_date', type: 'date', nullable: true }) admissionDate: string | null;

  @Column({ name: 'discharge_date', type: 'date', nullable: true }) dischargeDate: string | null;

  @Column({ name: 'principal_diagnosis_icd' }) principalDiagnosisIcd: string;

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', default: [] }) secondaryDiagnoses: string[];

  @Column({ name: 'procedures', type: 'jsonb', default: [] }) procedures: Record<string, any>[];

  @Column({ name: 'total_billed', type: 'numeric', precision: 12, scale: 2 }) totalBilled: number;

  @Column({ name: 'claimed_amount', type: 'numeric', precision: 12, scale: 2 }) claimedAmount: number;

  @Column({ name: 'co_payment_amount', type: 'numeric', precision: 12, scale: 2, default: 0 }) coPaymentAmount: number;

  @Column({ name: 'approved_amount', type: 'numeric', precision: 12, scale: 2, nullable: true }) approvedAmount: number | null;

  @Column({ name: 'paid_amount', type: 'numeric', precision: 12, scale: 2, nullable: true }) paidAmount: number | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true }) rejectionReason: string | null;

  @Column({ name: 'cdss_fraud_score', type: 'numeric', precision: 5, scale: 4, nullable: true }) cdssFraudScore: number | null;

  @Column({ name: 'cdss_approval_recommendation', nullable: true }) cdssApprovalRecommendation: string | null;

  @Column({ name: 'cdss_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true }) cdssConfidence: number | null;

  @Column({ name: 'cdss_flags', type: 'jsonb', default: [] }) cdssFlags: string[];

  @Column({ name: 'claim_status', default: 'submitted' }) claimStatus: string;

  @Column({ name: 'submitted_at', type: 'timestamp' }) submittedAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true }) reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy: string | null;

  @Column({ name: 'adjudicated_at', type: 'timestamp', nullable: true }) adjudicatedAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true }) paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
