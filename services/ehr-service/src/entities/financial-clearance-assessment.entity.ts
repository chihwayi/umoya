import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('financial_clearance_assessments')
@Index('idx_financial_clearance_assessments_patient_id', ['patientId'])
@Index('idx_financial_clearance_assessments_claim_id', ['claimId'])
@Index('idx_financial_clearance_assessments_eligibility_status', ['eligibilityStatus'])
export class FinancialClearanceAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  claimId: string | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'eligibility_status', type: 'varchar', length: 50, default: 'unknown' })
  eligibilityStatus: string;

  @Column({ name: 'estimated_responsibility', type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedResponsibility: number | null;

  @Column({ name: 'payer_estimated_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  payerEstimatedAmount: number | null;

  @Column({ name: 'authorization_required', type: 'boolean', default: false })
  authorizationRequired: boolean;

  @Column({ name: 'authorization_status', type: 'varchar', length: 50, nullable: true })
  authorizationStatus: string | null;

  @Column({ name: 'blockers', type: 'jsonb', default: () => "'[]'::jsonb" })
  blockers: Array<Record<string, any>>;

  @Column({ name: 'recommended_next_step', type: 'text', nullable: true })
  recommendedNextStep: string | null;

  @Column({ name: 'assessment_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  assessmentData: Record<string, any>;

  @Column({ name: 'assessed_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  assessedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
