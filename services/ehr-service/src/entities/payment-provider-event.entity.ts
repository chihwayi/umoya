import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payment_provider_events')
@Index('idx_payment_provider_events_transaction_id', ['transactionId'])
@Index('idx_payment_provider_events_provider_type', ['providerType'])
@Index('idx_payment_provider_events_event_type', ['eventType'])
export class PaymentProviderEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 120 })
  transactionId: string;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @Column({ name: 'provider_type', type: 'varchar', length: 50 })
  providerType: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: string;

  @Column({ name: 'provider_status', type: 'varchar', length: 80, nullable: true })
  providerStatus: string | null;

  @Column({ name: 'reference', type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 255, nullable: true })
  correlationId: string | null;

  @Column({ name: 'request_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  requestPayload: Record<string, any>;

  @Column({ name: 'response_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  responsePayload: Record<string, any>;

  @Column({ name: 'event_timestamp', type: 'timestamp with time zone', default: () => 'NOW()' })
  eventTimestamp: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
