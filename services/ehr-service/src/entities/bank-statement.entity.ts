import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('bank_statements')
@Index('idx_bank_statements_date', ['entryDate'])
@Index('idx_bank_statements_matched', ['isMatched'])
@Index('idx_bank_statements_reference', ['reference'])
export class BankStatement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'statement_date', type: 'date' })
  statementDate: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ name: 'entry_type', type: 'varchar', length: 10 })
  entryType: string;

  @Column({ name: 'is_matched', type: 'boolean', default: false })
  isMatched: boolean;

  @Column({ name: 'matched_payment_id', type: 'uuid', nullable: true })
  matchedPaymentId: string | null;

  @Column({ name: 'matched_at', type: 'timestamptz', nullable: true })
  matchedAt: Date | null;

  @Column({ name: 'matched_by', type: 'uuid', nullable: true })
  matchedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
