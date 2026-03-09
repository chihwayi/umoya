import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('exchange_rates')
@Index(['baseCurrency', 'quoteCurrency'])
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'base_currency', length: 10 })
  baseCurrency: string;

  @Column({ name: 'quote_currency', length: 10 })
  quoteCurrency: string;

  @Column({ type: 'numeric', precision: 18, scale: 8 })
  rate: number;

  @Column({ name: 'effective_at', type: 'timestamptz' })
  effectiveAt: Date;

  @Column({ length: 50, default: 'manual' })
  source: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

