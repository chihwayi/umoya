import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payment_verification_attempts')
@Index('idx_payment_verification_attempts_transaction_id', ['transactionId'])
@Index('idx_payment_verification_attempts_outcome', ['outcome'])
export class PaymentVerificationAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 120 })
  transactionId: string;

  @Column({ name: 'provider_type', type: 'varchar', length: 50, nullable: true })
  providerType: string | null;

  @Column({ name: 'reference', type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ name: 'outcome', type: 'varchar', length: 80 })
  outcome: string;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'response_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  responsePayload: Record<string, any>;

  @Column({ name: 'attempted_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  attemptedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
