import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('mobile_money_transactions')
export class MobileMoneyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'provider', length: 30 })
  provider: string;

  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string;

  @Column({ name: 'amount', type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'currency', length: 5 })
  currency: string;

  @Column({ name: 'provider_reference', length: 100, nullable: true })
  providerReference: string | null;

  @Column({ name: 'checkout_request_id', length: 100, nullable: true })
  checkoutRequestId: string | null;

  @Column({ name: 'status', length: 20, default: 'pending' })
  status: string; // pending | success | failed | cancelled

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'initiated_at', type: 'timestamptz', default: () => 'NOW()' })
  initiatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'receipt_number', length: 100, nullable: true })
  receiptNumber: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
