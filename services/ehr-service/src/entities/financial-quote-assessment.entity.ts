import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('financial_quote_assessments')
@Index('idx_financial_quote_assessments_transaction_id', ['transactionId'])
@Index('idx_financial_quote_assessments_patient_id', ['patientId'])
@Index('idx_financial_quote_assessments_quote_status', ['quoteStatus'])
@Index('idx_financial_quote_assessments_quoted_at', ['quotedAt'])
export class FinancialQuoteAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'payer_type', type: 'varchar', length: 30, default: 'self' })
  payerType: string;

  @Column({ name: 'quote_status', type: 'varchar', length: 40, default: 'estimate_only' })
  quoteStatus: string;

  @Column({ name: 'total_charge', type: 'decimal', precision: 12, scale: 2 })
  totalCharge: number;

  @Column({ name: 'estimated_payer_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedPayerAmount: number | null;

  @Column({ name: 'estimated_patient_responsibility', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedPatientResponsibility: number | null;

  @Column({ name: 'copay_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  copayAmount: number | null;

  @Column({ name: 'deductible_remaining', type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductibleRemaining: number | null;

  @Column({ name: 'quote_confidence', type: 'varchar', length: 20, default: 'medium' })
  quoteConfidence: string;

  @Column({ name: 'blockers', type: 'jsonb', default: () => "'[]'::jsonb" })
  blockers: Array<Record<string, any>>;

  @Column({ name: 'recommended_next_step', type: 'text', nullable: true })
  recommendedNextStep: string | null;

  @Column({ name: 'quote_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  quoteData: Record<string, any>;

  @Column({ name: 'quoted_at', type: 'timestamptz', default: () => 'NOW()' })
  quotedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
