import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('fee_schedule_items')
export class FeeScheduleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'fee_schedule_id', type: 'uuid' })
  feeScheduleId: string;

  @Index()
  @Column({ name: 'cpt_code', length: 10 })
  cptCode: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'charge_amount', type: 'decimal', precision: 12, scale: 2 })
  chargeAmount: string;

  @Column({ name: 'allowed_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  allowedAmount: string | null;

  @Column({ length: 10, nullable: true })
  modifier: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

