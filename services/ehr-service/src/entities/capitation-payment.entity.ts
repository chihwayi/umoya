import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('capitation_payments')
export class CapitationPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nhif_scheme_id', type: 'uuid', nullable: true })
  nhifSchemeId: string | null;

  @Column({ name: 'payment_month', type: 'date' })
  paymentMonth: string;

  @Column({ name: 'member_count', type: 'int' })
  memberCount: number;

  @Column({ name: 'rate_per_member', type: 'numeric', precision: 10, scale: 2 })
  ratePerMember: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ name: 'currency', length: 5 })
  currency: string;

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate: string | null;

  @Column({ name: 'reference', length: 50, nullable: true })
  reference: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
