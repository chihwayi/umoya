import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('payment_anomaly_flags')
@Index('idx_payment_anomaly_flags_status', ['status'])
@Index('idx_payment_anomaly_flags_severity', ['severity'])
@Index('idx_payment_anomaly_flags_bank_entry_id', ['bankEntryId'])
@Index('idx_payment_anomaly_flags_payment_id', ['paymentId'])
@Index('idx_payment_anomaly_flags_detected_at', ['detectedAt'])
@Index('idx_payment_anomaly_flags_fingerprint', ['fingerprint'], { unique: true })
export class PaymentAnomalyFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bank_entry_id', type: 'uuid', nullable: true })
  bankEntryId: string | null;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'anomaly_type', type: 'varchar', length: 80 })
  anomalyType: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  severity: string;

  @Column({ name: 'anomaly_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  anomalyScore: number;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  fingerprint: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence: Record<string, any>;

  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'NOW()' })
  detectedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
