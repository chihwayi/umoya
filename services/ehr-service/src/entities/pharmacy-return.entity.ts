import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { PharmacyDispensing } from './pharmacy-dispensing.entity';
import { User } from './user.entity';
import { PharmacyReturnItem } from './pharmacy-return-item.entity';

export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'processed';

@Entity('pharmacy_returns')
export class PharmacyReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacyDispensing, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dispensing_id' })
  dispensing: PharmacyDispensing;

  @Column({ name: 'dispensing_id', type: 'uuid' })
  dispensingId: string;

  @Column({ name: 'return_date', type: 'date', default: () => 'CURRENT_DATE' })
  returnDate: Date;

  @Column({ name: 'return_reason', type: 'varchar', length: 100, nullable: true })
  returnReason?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'returned_by' })
  returnedBy?: User;

  @Column({ name: 'returned_by', type: 'uuid', nullable: true })
  returnedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy?: User;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedById?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ReturnStatus;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  refundAmount: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => PharmacyReturnItem, item => item.return, { cascade: true })
  items: PharmacyReturnItem[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy?: User;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy?: User;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


