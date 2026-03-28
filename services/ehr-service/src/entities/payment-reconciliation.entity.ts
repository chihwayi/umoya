import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payment_reconciliations')
@Index('idx_payment_reconciliations_bank_entry_id', ['bankEntryId'])
@Index('idx_payment_reconciliations_payment_id', ['paymentId'])
export class PaymentReconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bank_entry_id', type: 'uuid' })
  bankEntryId: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @Column({ name: 'match_confidence', type: 'varchar', length: 20, default: 'manual' })
  matchConfidence: string;

  @Column({ name: 'match_reason', type: 'text', nullable: true })
  matchReason: string | null;

  @Column({ name: 'matched_by', type: 'uuid', nullable: true })
  matchedBy: string | null;

  @Column({ name: 'matched_at', type: 'timestamptz', default: () => 'NOW()' })
  matchedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
